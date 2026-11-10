"use client";

import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { EffectComposer, N8AO } from "@react-three/postprocessing";
import { easing } from "maath";
import { useCallback, useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import type { HousePlan, PlanFloor } from "@/features/houses/schema";

import {
  modelAt,
  NO_CUT,
  PORTRAIT,
  pickAt,
  enterAt,
  type ModelPhase,
  type ModelScreen,
  type ModelState,
} from "../../_lib/model-choreography";
import {
  floorModel,
  plotModel,
  SLAB_DEPTH,
  STOREY_HEIGHT,
  WALL_HEIGHT,
  type Box,
  type EntranceLeaf,
} from "../../_lib/model-geometry";
import type { ModelPalette } from "../../_lib/model-palette";
import {
  floorAnnotations,
  furnitureSolids,
  planSheet,
  type FurnitureSolid,
} from "../../_lib/plan-sheet";
import { floorLevel, roomUnder } from "../../_lib/tour";
import { revealRooms, ROOM_BAND, sweepFront, type SweepAxis } from "../../_lib/room-reveal";

import {
  fade,
  warmFades,
  MATERIALS,
  MAX_ROOMS,
  skyMaterial,
  sweepLines,
  sweepMaterial,
  sweepUniforms,
  type MaterialId,
  type SweepMaterial,
  type SweepUniforms,
  VISIBLE,
} from "./model-materials";
import { PlacedFurniture } from "./PlacedFurniture";
import { drawingMaterial, drawSheet, sheetQuad } from "./plan-drawing";

// The house model (ADR 0010): a Three.js scene drawn as the choreography has it for the scroll.
// It starts as the sheet, the ground floor seen from straight above and cut at +1,20 m: paper
// lined in ink, the cut walls solid as a plan's poché, each room's name and m² on its floor. As
// the scroll goes on, the cut rises, the camera tips back and comes down to the front door, and
// walks in; each room's materials and light come in as it is crossed into. It renders on demand:
// only while the scroll moves or the ease has not landed, never at rest. Three.js objects are only
// touched through refs, inside frame callbacks and effects, as the React Compiler rules ask: hence
// `partsOf`, which finds the house's materials on its group rather than in what made them.

/** Where the plan goes on the canvas, in CSS px from its top left corner. */
export type DrawingArea = { left: number; top: number; width: number; height: number };

/** What the HUD shows: the lens, the camera's height and where the house is cut, if it is. */
export type HudReading = { fov: number; height: number; cut: number | null };
export type ShowHud = (reading: HudReading) => void;

/** Seconds the ease of the scroll takes to cover most of the way to where the page is. */
const EASE = 0.25;
/** Closer than this the ease has landed, and the scene stops rendering. */
const SETTLED = 1e-6;
/** How strong the house's lines are against the cut walls' poché, which stays the darkest. */
const EDGE_OPACITY = 0.55;

/** Several boxes as one geometry. */
function boxesGeometry(boxes: readonly Box[]) {
  return boxes.map(({ x, y, z, w, h, d }) =>
    new THREE.BoxGeometry(w, h, d).translate(x + w / 2, y + h / 2, z + d / 2),
  );
}

/**
 * The plot's trees, at each foot: palms and olives in turn. A palm's trunk leans a little as it
 * rises and its fronds droop from its head; an olive is a short trunk under a few soft crowns.
 */
function treesGeometry(feet: readonly { x: number; z: number }[]) {
  const crowns: THREE.BufferGeometry[] = [];
  const trunks: THREE.BufferGeometry[] = [];
  feet.forEach(({ x, z }, i) => {
    if (i % 2 === 0) {
      const height = 5.4 + (i % 3) * 0.6;
      const lean = { x: 0.35 * Math.cos(i * 2.3), z: 0.35 * Math.sin(i * 2.3) };
      const segments = 6;
      for (let s = 0; s < segments; s++) {
        const t = s / segments;
        const length = height / segments;
        const radius = 0.2 - 0.07 * t;
        trunks.push(
          new THREE.CylinderGeometry(radius * 0.92, radius, length + 0.02, 7).translate(
            x + lean.x * t * t,
            length * (s + 0.5),
            z + lean.z * t * t,
          ),
        );
      }
      const head = new THREE.Vector3(x + lean.x, height, z + lean.z);
      const fronds = 9;
      for (let f = 0; f < fronds; f++) {
        const frond = new THREE.BoxGeometry(2.4, 0.04, 0.55).translate(1.2, 0, 0);
        frond.rotateZ(-0.42 - (f % 3) * 0.12);
        frond.rotateY((f / fronds) * Math.PI * 2 + i);
        crowns.push(frond.translate(head.x, head.y, head.z));
      }
    } else {
      trunks.push(new THREE.CylinderGeometry(0.13, 0.2, 1.7, 7).translate(x, 0.85, z));
      for (const [dx, dy, dz, r] of [
        [0, 2.3, 0, 1.15],
        [0.7, 2.0, 0.3, 0.8],
        [-0.6, 2.1, -0.4, 0.85],
      ] as const) {
        crowns.push(
          new THREE.IcosahedronGeometry(r, 1).scale(1, 0.72, 1).translate(x + dx, dy, z + dz),
        );
      }
    }
  });
  return { crowns, trunks };
}

/** Rooms whose floor stays in microcement: the wet ones, and the stair. */
const BARE_FLOORS = new Set<string>(["bath", "toilet", "utility", "spa", "lift", "stair", "void"]);
/** How thick the floorboards are over the slab. */
const BOARDS = 0.015;

/** A storey's floorboards: light oak over the slab of each of its rooms indoors (ADR 0011). */
function floorboards(floor: PlanFloor): Box[] {
  return floor.rooms
    .filter((room) => !room.open && !BARE_FLOORS.has(room.kind))
    .map(({ x, z, w, d }) => ({ x, y: 0, z, w, h: BOARDS, d }));
}

/** A piece of furniture: a box, or a cylinder within its rectangle. */
function furnitureGeometry({ x, y, z, w, h, d, round }: FurnitureSolid) {
  if (round) {
    return new THREE.CylinderGeometry(w / 2, w / 2, h, 20).translate(
      x + w / 2,
      y + h / 2,
      z + d / 2,
    );
  }
  return new THREE.BoxGeometry(w, h, d).translate(x + w / 2, y + h / 2, z + d / 2);
}

/** A floor's white edge: a band round its footprint, past its walls, over its slab's edge. */
function fasciaBoxes(floor: PlanFloor): Box[] {
  const rooms = floor.rooms.filter(({ kind }) => kind !== "void");
  if (rooms.length === 0) return [];
  const x0 = Math.min(...rooms.map(({ x }) => x)) - FASCIA_OUT;
  const z0 = Math.min(...rooms.map(({ z }) => z)) - FASCIA_OUT;
  const x1 = Math.max(...rooms.map(({ x, w }) => x + w)) + FASCIA_OUT;
  const z1 = Math.max(...rooms.map(({ z, d }) => z + d)) + FASCIA_OUT;
  const y = -FASCIA;
  const t = FASCIA_DEPTH;
  return [
    { x: x0, y, z: z0, w: x1 - x0, h: FASCIA, d: t },
    { x: x0, y, z: z1 - t, w: x1 - x0, h: FASCIA, d: t },
    { x: x0, y, z: z0, w: t, h: FASCIA, d: z1 - z0 },
    { x: x1 - t, y, z: z0, w: t, h: FASCIA, d: z1 - z0 },
  ];
}
/** How deep a floor's white edge runs down from its level, how far past the walls, how thick. */
const FASCIA = 0.5;
const FASCIA_OUT = 0.14;
const FASCIA_DEPTH = 0.2;
/** How far either side of the front door its wall is clad in oak. */
const CLADDING = 2.6;

const merged = (parts: THREE.BufferGeometry[]) => {
  if (parts.length === 0) return null;
  // Boxes and cylinders are indexed, the olives' crowns are not: merged, none is.
  const flat = parts.map((part) => (part.index ? part.toNonIndexed() : part));
  const geometry = mergeGeometries(flat);
  for (const part of new Set([...parts, ...flat])) part.dispose();
  return geometry;
};

const emptyParts = <T,>(make: () => T) =>
  Object.fromEntries((Object.keys(MATERIALS) as MaterialId[]).map((id) => [id, make()])) as Record<
    MaterialId,
    T
  >;

/** A floor's boxes and furniture merged by material, with its drawing's lines over every edge. */
function floorParts(
  boxes: Record<MaterialId, Box[]>,
  extra: Record<MaterialId, THREE.BufferGeometry[]>,
) {
  const faces = Object.fromEntries(
    (Object.keys(boxes) as MaterialId[]).map((id) => [
      id,
      merged([...boxesGeometry(boxes[id]), ...extra[id]]),
    ]),
  ) as Record<MaterialId, THREE.BufferGeometry | null>;
  // The drawing's lines: every edge, the glass's included, but not the water's surface.
  const lined = (Object.keys(faces) as MaterialId[]).filter((id) => id !== "water");
  const edges = merged(
    lined.flatMap((id) => (faces[id] ? [new THREE.EdgesGeometry(faces[id], 25)] : [])),
  );
  return { faces, edges };
}

/** One floor of the model: its faces by material, its lines, and its cut walls' tops. */
export type FloorMesh = ReturnType<typeof floorParts> & {
  id: string;
  /** Its level, in metres over the ground floor. */
  level: number;
  /** Its full-height walls' tops, at its level, for the cut to show as the plan's poché. */
  caps: THREE.BufferGeometry | null;
};

/**
 * The house and its plot in boxes, floor by floor, each at its level, by material: Exterior first,
 * then each storey, for a floor picked to lift the ones above out of the way. Its front door apart.
 */
function houseGeometry(plan: HousePlan) {
  const built = plan.floors.filter(({ kind }) => kind !== "plot");
  let entrance: EntranceLeaf | undefined;
  const storeys = built.map((floor, level): FloorMesh => {
    const parts = emptyParts<Box[]>(() => []);
    const furniture = emptyParts<THREE.BufferGeometry[]>(() => []);
    const model = floorModel(plan, floor, { next: built[level + 1], below: built[level - 1] });
    const lift = (boxes: Box[]) =>
      boxes.map((box) => ({ ...box, y: box.y + level * STOREY_HEIGHT }));
    // Above the ground floor, the walls go down over the edge of the slab they stand on: it only
    // runs under the rooms, and would leave a slot all round between one floor and the next.
    const walls =
      level === 0
        ? model.walls
        : model.walls.map((wall) =>
            wall.y <= 0 ? { ...wall, y: wall.y - SLAB_DEPTH, h: wall.h + SLAB_DEPTH } : wall,
          );
    // On the ground floor, the wall either side of the front door is clad in oak.
    const door = level === 0 ? model.entrance : undefined;
    const clad = (wall: Box) =>
      door !== undefined &&
      wall.d < 0.4 &&
      Math.abs(wall.z + wall.d / 2 - door.hinge.z) < 0.2 &&
      wall.x + wall.w > door.hinge.x - CLADDING &&
      wall.x < door.hinge.x + CLADDING;
    parts.oak.push(...lift(walls.filter(clad)));
    parts.lime.push(
      ...lift([
        ...walls.filter((wall) => !clad(wall)),
        ...model.heads,
        ...model.lids,
        ...model.canopies,
      ]),
    );
    if (level > 0) parts.lime.push(...lift(fasciaBoxes(floor)));
    parts.microcement.push(...lift([...model.slabs, ...model.stair]));
    parts.parquet.push(...lift(floorboards(floor)));
    // Decks in oak, but on the roof in pale stone, as the white terraces of the coast are.
    const roof = floor.kind === "roof";
    parts.oak.push(...lift([...model.joinery, ...(roof ? [] : model.decks), ...model.soffits]));
    if (roof) parts.stone.push(...lift(model.decks));
    parts.foliage.push(...lift(model.planters));
    parts.glass.push(...lift(model.glass));
    parts.frame.push(...lift(model.frames));
    for (const solid of furnitureSolids(plan, floor)) {
      furniture[solid.material].push(
        furnitureGeometry({ ...solid, y: solid.y + level * STOREY_HEIGHT }),
      );
    }
    if (level === 0 && model.entrance) entrance = model.entrance;
    // Its full-height walls, whose tops the cut shows as the plan's poché.
    const poche = model.walls.filter(({ y, h }) => y <= 0 && h >= WALL_HEIGHT - 0.01);
    const caps = merged(
      poche.map(({ x, z, w, d }) =>
        new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2).translate(x + w / 2, 0, z + d / 2),
      ),
    );
    return { id: floor.id, level: level * STOREY_HEIGHT, caps, ...floorParts(parts, furniture) };
  });
  const plot = plotModel(plan);
  const parts = emptyParts<Box[]>(() => []);
  parts.ground.push(...plot.land);
  parts.stone.push(...plot.decks, ...(plot.pool ? [plot.pool.basin, ...plot.pool.walls] : []));
  if (plot.pool) parts.water.push(plot.pool.water);
  const trees = treesGeometry(plot.trees);
  const extra = emptyParts<THREE.BufferGeometry[]>(() => []);
  extra.foliage.push(...trees.crowns);
  extra.oak.push(...trees.trunks);
  const exterior = plan.floors.find(({ kind }) => kind === "plot");
  const floors: FloorMesh[] = [
    { id: exterior?.id ?? "plot", level: 0, caps: null, ...floorParts(parts, extra) },
    ...storeys,
  ];
  return { floors, entrance };
}

/** The scene's screen, as the choreography frames the sheet on it. */
function screenOf(size: { width: number; height: number }, area: DrawingArea | null): ModelScreen {
  const rect = area ?? { left: 0, top: 0, width: size.width, height: size.height };
  return {
    aspect: size.width / Math.max(size.height, 1),
    area: {
      x: rect.left / size.width,
      y: rect.top / size.height,
      width: Math.max(rect.width, 1) / size.width,
      height: Math.max(rect.height, 1) / size.height,
    },
  };
}

/** A room of the plan, by its floor's id and its own. */
export type RoomKey = { floor: string; room: string };

/** A floor picked from the whole house, or none to go back to it: each pick a new `serial`. */
export type FloorRequest = {
  floor: string | null;
  serial: number;
  /** Straight there, without the way: when the scroll has left the whole house. */
  instant: boolean;
};

/**
 * How long picking a floor takes, in seconds, from the camera's move to the end of its sweep: a
 * sequence of the scene, as the scroll's are, not a control's motion.
 */
const PICK_SECONDS = 3.4;
/** How long going back to the whole house takes, in seconds. */
const WHOLE_SECONDS = 1.6;

/** A room of the picked floor to go into, or none to come back out over it: each a new `serial`. */
export type RoomRequest = { room: string | null; serial: number };

/** How long going into a room takes, in seconds, and coming back out over its floor. */
const ROOM_SECONDS = 2.8;
/** Coming out of a room started on its way in takes as long as it had gone, but never less. */
const MIN_ROOM_SECONDS = 0.6;

/**
 * The state every part of the scene reads, and the loop that keeps it. What eases is the scroll
 * itself, not the camera's parts: the lens and the distance stay in step however fast it goes.
 * Once a floor is picked, the scene goes there over its own time, from wherever it was.
 */
function useChoreography(
  plan: HousePlan,
  progress: RefObject<number>,
  area: RefObject<DrawingArea | null>,
  floorArea: RefObject<DrawingArea | null>,
  still: boolean,
  phase: ModelPhase,
  request: FloorRequest,
  entry: RoomRequest,
): RefObject<ModelState> {
  const size = useThree(({ size }) => size);
  const state = useRef<ModelState>(modelAt(progress.current, plan, { still }));
  // maath keeps the eased value's velocity on its object.
  const eased = useRef({ progress: progress.current });
  // The first frame lands where the page already is, instead of easing in from the top.
  const landed = useRef(false);
  /** The pick under way: where it started from, and when. None once back on the scroll. */
  const picking = useRef<{ serial: number; from: ModelState; start: number } | null>(null);
  /**
   * The way into a room of the picked floor, or back out: from how far in to where, and when it
   * set off, once the floor has landed. How far in the camera is, 0–1, kept for the next one.
   */
  const going = useRef<{
    room: string;
    from: number;
    to: 0 | 1;
    start: number | null;
  } | null>(null);
  const entrySeen = useRef(0);
  const inside = useRef(0);
  const invalidate = useThree(({ invalidate }) => invalidate);

  useFrame((_, delta) => {
    const target = progress.current;
    const ease = eased.current;
    if (still || !landed.current) ease.progress = target;
    else easing.damp(ease, "progress", target, EASE, Math.min(delta, 0.05));
    landed.current = true;
    const moving = Math.abs(ease.progress - target) > SETTLED;
    if (!moving) ease.progress = target;
    const whole = modelAt(ease.progress, plan, { still, screen: screenOf(size, area.current) });
    const now = performance.now();
    const known = picking.current;
    if (request.serial > 0 && known?.serial !== request.serial) {
      picking.current = { serial: request.serial, from: state.current, start: now };
      // Another floor, or the whole house: no room of the last one.
      going.current = null;
      inside.current = 0;
    }
    if (entry.serial !== entrySeen.current) {
      entrySeen.current = entry.serial;
      const room = entry.room ?? going.current?.room;
      going.current = room
        ? { room, from: inside.current, to: entry.room ? 1 : 0, start: null }
        : null;
    }
    const pick = picking.current;
    let next = whole;
    let changing = false;
    if (pick && pick.serial === request.serial) {
      const seconds = request.floor ? PICK_SECONDS : WHOLE_SECONDS;
      const t = request.instant ? 1 : (now - pick.start) / 1000 / seconds;
      if (request.floor || t < 1) {
        next = pickAt(
          plan,
          { from: pick.from, floor: request.floor, whole, t },
          { still, screen: screenOf(size, floorArea.current ?? area.current) },
        );
        changing = t < 1;
      }
      // Into a room of the floor, or back out, once the floor has landed.
      const room = going.current;
      if (room && request.floor && !changing) {
        room.start ??= now;
        const span = Math.abs(room.to - room.from);
        const seconds = Math.max(ROOM_SECONDS * span, MIN_ROOM_SECONDS);
        const t = Math.min((now - room.start) / 1000 / seconds, 1);
        next = enterAt(
          plan,
          { floor: request.floor, room: room.room, from: room.from, to: room.to, t },
          { still, screen: screenOf(size, floorArea.current ?? area.current) },
        );
        inside.current = still ? room.to : room.from + (room.to - room.from) * t;
        changing = t < 1;
      }
    }
    state.current = next;
    if (moving || changing) invalidate();
  }, -1);

  // A floor picked, or the whole house again, a room gone into or out of: wake the loop up.
  useEffect(() => invalidate(), [invalidate, request, entry]);

  // With reduced motion the section moves the target once the scene has faded out.
  useEffect(() => invalidate(), [invalidate, phase]);

  // Scrolling and resizing move the target: wake the loop up.
  useEffect(() => {
    const wake = () => invalidate();
    window.addEventListener("scroll", wake, { passive: true });
    window.addEventListener("resize", wake);
    return () => {
      window.removeEventListener("scroll", wake);
      window.removeEventListener("resize", wake);
    };
  }, [invalidate]);

  return state;
}

const AXIS_CODE: Record<SweepAxis, number> = { "+x": 0, "-x": 1, "+z": 2, "-z": 3 };

/** The rooms' boxes and sweeps, as the materials' uniforms take them. */
function useRoomUniforms(plan: HousePlan) {
  const rooms = useMemo(() => revealRooms(plan).slice(0, MAX_ROOMS), [plan]);
  const uniforms = useMemo(() => {
    const made = sweepUniforms();
    made.uBand.value = ROOM_BAND;
    made.uRoomCount.value = rooms.length;
    rooms.forEach(({ box }, i) => {
      made.uRoomBox.value[i]!.set(box.x0, box.z0, box.x1, box.z1);
      made.uRoomSweep.value[i]!.set(box.y0, box.y1, 0, sweepFront(rooms[i]!.room, "+z", 0));
    });
    return made;
  }, [rooms]);
  return { rooms, uniforms };
}

/** Moves each room's sweep front to where the choreography has it. */
function placeFronts(uniforms: SweepUniforms, plan: HousePlan, state: ModelState) {
  const rooms = revealRooms(plan);
  state.rooms.slice(0, MAX_ROOMS).forEach(({ reveal, axis }, i) => {
    const sweep = uniforms.uRoomSweep.value[i]!;
    sweep.z = AXIS_CODE[axis];
    sweep.w = sweepFront(rooms[i]!.room, axis, reveal);
  });
}

/** Where a floor stands in a state of the scene. */
const poseOf = (state: ModelState, floorId: string) =>
  state.floors.find(({ id }) => id === floorId);

/** Moves the house's cut to a height. */
function cutAt(plane: THREE.Plane | undefined, height: number) {
  if (plane) plane.constant = height;
}

/** How see-through the glass is once swept. */
const GLASS_OPACITY = 0.32;
const materialIds = Object.keys(MATERIALS) as MaterialId[];

/** The scene's own materials, on the sweep's uniforms they share, cut by one horizontal plane: a
 * set for each floor, for a floor to fade on its own while the others stay. */
function useSweepMaterials(uniforms: SweepUniforms, count: number) {
  const made = useMemo(() => {
    // Keeps what is below the cut: a plan's, as it rises, then the whole house.
    const clipping = [new THREE.Plane(new THREE.Vector3(0, -1, 0), NO_CUT)];
    const sets = Array.from({ length: count }, () => ({
      materials: Object.fromEntries(
        materialIds.map((id) => [id, sweepMaterial(id, uniforms, clipping)]),
      ) as Record<MaterialId, SweepMaterial>,
      lines: sweepLines(uniforms, clipping),
    }));
    return { sets, clipping };
  }, [uniforms, count]);
  useEffect(
    () => () => {
      for (const { materials, lines } of made.sets) {
        for (const material of Object.values(materials)) material.dispose();
        lines.dispose();
      }
    },
    [made],
  );
  return made;
}

/** The house's materials and lines, as its group holds them, for frames and effects to move. */
function partsOf(group: THREE.Group | null) {
  const materials: { id: MaterialId; material: SweepMaterial }[] = [];
  const lines: THREE.LineBasicMaterial[] = [];
  group?.traverse((child) => {
    if (child instanceof THREE.LineSegments && child.name === "lines") {
      lines.push(child.material as THREE.LineBasicMaterial);
    } else if (child instanceof THREE.Mesh && child.name in MATERIALS) {
      materials.push({ id: child.name as MaterialId, material: child.material as SweepMaterial });
    }
  });
  return { materials, lines, sweep: materials[0]?.material.userData.sweep };
}

/** The angle a box running along +x turns about the vertical to run from `a` towards `b`. */
const turnTowards = (a: { x: number; z: number }, b: { x: number; z: number }) =>
  Math.atan2(-(b.z - a.z), b.x - a.x);

/** The front door's leaf, hung from its hinge, closed across its gap until the walk opens it. */
function FrontDoor({
  leaf,
  material,
  lines,
  state,
}: {
  leaf: EntranceLeaf;
  material: SweepMaterial;
  lines: THREE.LineBasicMaterial;
  state: RefObject<ModelState>;
}) {
  const hinge = useRef<THREE.Group>(null);
  const geometry = useMemo(() => {
    const width = Math.hypot(leaf.closed.x - leaf.hinge.x, leaf.closed.z - leaf.hinge.z);
    const box = new THREE.BoxGeometry(width, leaf.height, leaf.thickness).translate(
      width / 2,
      leaf.height / 2,
      0,
    );
    return { box, edges: new THREE.EdgesGeometry(box, 25) };
  }, [leaf]);
  useEffect(
    () => () => {
      geometry.box.dispose();
      geometry.edges.dispose();
    },
    [geometry],
  );
  const closed = turnTowards(leaf.hinge, leaf.closed);
  let open = turnTowards(leaf.hinge, leaf.open);
  // The short way round, a quarter turn.
  while (open - closed > Math.PI) open -= Math.PI * 2;
  while (open - closed < -Math.PI) open += Math.PI * 2;
  useFrame(() => {
    if (hinge.current)
      hinge.current.rotation.y = THREE.MathUtils.lerp(closed, open, state.current.door);
  });
  return (
    <group ref={hinge} position={[leaf.hinge.x, 0, leaf.hinge.z]}>
      <mesh name="oak-door" geometry={geometry.box} material={material} castShadow receiveShadow />
      <lineSegments geometry={geometry.edges} material={lines} />
    </group>
  );
}

/**
 * A floor's cut walls' tops in ink, as a plan's poché, at the height of the cut while it runs
 * through them. From straight above, the walls' own inside would lie level with the floor and lose
 * to it.
 */
function Poche({
  caps,
  level,
  palette,
  state,
}: {
  caps: THREE.BufferGeometry;
  level: number;
  palette: ModelPalette;
  state: RefObject<ModelState>;
}) {
  const cap = useRef<THREE.Mesh>(null);
  const material = useMemo(() => new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), []);
  useEffect(() => () => material.dispose(), [material]);
  useEffect(() => {
    material.color.set(palette.ink);
  }, [material, palette]);
  useFrame(() => {
    const mesh = cap.current;
    if (!mesh) return;
    const { cut } = state.current;
    mesh.visible = cut > level && cut < level + WALL_HEIGHT;
    mesh.position.y = cut - 0.002;
  });
  return <mesh ref={cap} geometry={caps} material={material} />;
}

type FloorProps = {
  plan: HousePlan;
  name: string;
  mesh: FloorMesh;
  materials: Record<MaterialId, SweepMaterial>;
  lines: THREE.LineBasicMaterial;
  palette: ModelPalette;
  mobile: boolean;
  uniforms: SweepUniforms;
  clipping: THREE.Plane[];
  state: RefObject<ModelState>;
  entrance?: EntranceLeaf;
};

/**
 * One floor of the house: its faces, its lines, its poché, its drawing and its plan's axes,
 * dimensions and title. It rises out of the way and fades as the choreography has it.
 */
function Floor({
  plan,
  name,
  mesh,
  materials,
  lines,
  palette,
  mobile,
  uniforms,
  clipping,
  state,
  entrance,
}: FloorProps) {
  const group = useRef<THREE.Group>(null);
  const floor = plan.floors.find(({ id }) => id === mesh.id);
  useFrame(() => {
    const holder = group.current;
    const pose = poseOf(state.current, mesh.id);
    if (!holder || !pose) return;
    holder.position.y = pose.lift;
    holder.visible = pose.opacity > VISIBLE;
    for (const id of materialIds) {
      fade(materials[id], pose.opacity, id === "glass" ? GLASS_OPACITY : 1);
    }
    fade(lines, pose.opacity, EDGE_OPACITY);
  });
  return (
    <group ref={group} name={`floor:${mesh.id}`}>
      {materialIds.map((id) => {
        const faces = mesh.faces[id];
        return (
          faces && (
            <mesh
              key={id}
              name={id}
              geometry={faces}
              material={materials[id]}
              castShadow={id !== "glass" && id !== "water"}
              receiveShadow={id !== "glass"}
            />
          )
        );
      })}
      {mesh.edges && <lineSegments name="lines" geometry={mesh.edges} material={lines} />}
      {mesh.caps && <Poche caps={mesh.caps} level={mesh.level} palette={palette} state={state} />}
      {floor && floor.kind !== "plot" && (
        <FloorDrawing
          plan={plan}
          floor={floor}
          name={name}
          level={mesh.level}
          palette={palette}
          mobile={mobile}
          uniforms={uniforms}
          clipping={clipping}
        />
      )}
      {floor && (
        <FloorPlanMarks
          plan={plan}
          floor={floor}
          name={name}
          level={mesh.level}
          palette={palette}
          mobile={mobile}
          state={state}
        />
      )}
      {floor && floor.kind !== "plot" && (
        <PlacedFurniture
          plan={plan}
          floor={floor}
          level={mesh.level}
          materials={materials}
          lines={lines}
          mobile={mobile}
          state={state}
        />
      )}
      {entrance && (
        <FrontDoor leaf={entrance} material={materials.oak} lines={lines} state={state} />
      )}
    </group>
  );
}

/** The house: paper lined in ink, cut as the choreography has it, each room swept in turn. */
function HouseMesh({
  plan,
  name,
  palette,
  mobile,
  state,
}: {
  plan: HousePlan;
  name: string;
  palette: ModelPalette;
  mobile: boolean;
  state: RefObject<ModelState>;
}) {
  const group = useRef<THREE.Group>(null);
  const geometry = useMemo(() => houseGeometry(plan), [plan]);
  const { uniforms } = useRoomUniforms(plan);
  const { sets, clipping } = useSweepMaterials(uniforms, geometry.floors.length);
  /** The front door hangs on the ground floor: the first storey. */
  const groundId = plan.floors.find(({ kind }) => kind !== "plot")?.id;
  const invalidate = useThree(({ invalidate }) => invalidate);
  const gl = useThree(({ gl }) => gl);
  const scene = useThree(({ scene }) => scene);
  const camera = useThree(({ camera }) => camera);
  useEffect(
    () => () => {
      for (const floor of geometry.floors) {
        for (const part of [...Object.values(floor.faces), floor.edges, floor.caps]) {
          part?.dispose();
        }
      }
    },
    [geometry],
  );

  // The materials' programs and the shadows', built while the sheet is on screen, for the walk not
  // to stall on them: once with the house in colour, out of sight, then as the choreography has it;
  // and as each floor fades, for picking one not to stall either.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await gl.compileAsync(scene, camera);
      if (cancelled) return;
      const target = new THREE.WebGLRenderTarget(1, 1);
      gl.setRenderTarget(target);
      gl.render(scene, camera);
      gl.setRenderTarget(null);
      target.dispose();
      const holder = group.current;
      if (holder) warmFades(gl, holder, camera, scene);
      invalidate();
    })();
    return () => {
      cancelled = true;
    };
  }, [gl, scene, camera, palette, invalidate]);

  // Día and Noche: the paper, the cut, and what glows at dusk, without reloading anything.
  useEffect(() => {
    const { materials, lines, sweep } = partsOf(group.current);
    const { scene } = palette;
    sweep?.uPaperLight.value.set(palette.intensity.ambient, palette.intensity.sun);
    sweep?.uCut.value.set(scene.cut);
    sweep?.uPoche.value.set(palette.ink);
    sweep?.uGlow.value.set(scene.glow);
    for (const { id, material } of materials) {
      material.userData.paperColor.value.set(id === "water" ? palette.water : palette.paper);
      material.emissive.set("#000000");
      if (id === "glass" && scene.rooms) {
        material.emissive.set(scene.rooms.color);
        material.emissiveIntensity = 1.4;
      }
      if (id === "water" && scene.pool) {
        material.emissive.set(scene.pool.color);
        material.emissiveIntensity = 0.55;
      }
    }
    for (const line of lines) line.color.set(palette.ink);
    invalidate();
  }, [palette, invalidate, sets]);

  useFrame(() => {
    const current = state.current;
    // The plane and the uniforms are shared by every material: moved once, they move for all.
    cutAt(partsOf(group.current).materials[0]?.material.clippingPlanes?.[0], current.cut);
    placeFronts(uniforms, plan, current);
  });

  return (
    <group ref={group}>
      {geometry.floors.map((mesh, i) => (
        <Floor
          key={mesh.id}
          plan={plan}
          name={name}
          mesh={mesh}
          materials={sets[i]!.materials}
          lines={sets[i]!.lines}
          palette={palette}
          mobile={mobile}
          uniforms={uniforms}
          clipping={clipping}
          state={state}
          entrance={mesh.id === groundId ? geometry.entrance : undefined}
        />
      ))}
    </group>
  );
}

/** How many pixels a metre the sheet is drawn at: sharper on a laptop than on a phone. */
const SHEET_PPM = { desktop: 120, mobile: 72 };
/** How far over its floor a storey's drawing lies, clear of its slab and of its decks. */
const DRAWING_LIFT = 0.07;
/** And its plan's axes and dimensions, a little higher still. */
const MARKS_LIFT = 0.09;

/** Draws a sheet on a quad once the fonts are in, and lays it in its holder. */
function useSheetMesh(
  make: (font: string) => THREE.Mesh | null,
  holder: RefObject<THREE.Group | null>,
) {
  const invalidate = useThree(({ invalidate }) => invalidate);
  useEffect(() => {
    const group = holder.current;
    if (!group) return;
    let cancelled = false;
    let made: THREE.Mesh | null = null;
    void document.fonts.ready.then(() => {
      if (cancelled) return;
      made = make(getComputedStyle(document.body).fontFamily);
      if (!made) return;
      group.add(made);
      invalidate();
    });
    return () => {
      cancelled = true;
      if (!made) return;
      group.remove(made);
      made.geometry.dispose();
      const material = made.material as THREE.MeshBasicMaterial;
      material.map?.dispose();
      material.dispose();
    };
  }, [make, holder, invalidate]);
}

/**
 * A storey's drawing on its floor: the ground floor's the whole sheet, on its paper; the ones
 * above, their ink. It goes room by room with the sweep, and is cut with the house.
 */
function FloorDrawing({
  plan,
  floor,
  name,
  level,
  palette,
  mobile,
  uniforms,
  clipping,
}: {
  plan: HousePlan;
  floor: PlanFloor;
  name: string;
  level: number;
  palette: ModelPalette;
  mobile: boolean;
  uniforms: SweepUniforms;
  clipping: THREE.Plane[];
}) {
  const group = useRef<THREE.Group>(null);
  const gl = useThree(({ gl }) => gl);
  const ground = level === 0;
  const make = useCallback(
    (font: string) => {
      const drawing = planSheet(plan, floor, name);
      const texture = drawSheet(
        drawing,
        {
          paper: ground ? palette.background : null,
          fill: ground ? palette.background : palette.paper,
          ink: palette.ink,
          font,
        },
        mobile ? SHEET_PPM.mobile : SHEET_PPM.desktop,
        gl.capabilities.maxTextureSize,
      );
      if (!texture) return null;
      const mesh = new THREE.Mesh(
        sheetQuad(drawing, level + DRAWING_LIFT),
        drawingMaterial(texture, uniforms, clipping),
      );
      mesh.renderOrder = 1;
      return mesh;
    },
    [plan, floor, name, level, ground, palette, mobile, uniforms, clipping, gl],
  );
  useSheetMesh(make, group);
  return <group ref={group} />;
}

/** Shows a floor's plan's marks, laid in their holder, so much. */
function showMarks(holder: THREE.Group | null, opacity: number) {
  const marks = holder?.children[0];
  if (!(marks instanceof THREE.Mesh)) return;
  (marks.material as THREE.MeshBasicMaterial).opacity = opacity;
  marks.visible = opacity > VISIBLE;
}

/**
 * A floor's plan's axes with their bubbles, its chains of dimensions, its title block and its
 * north, in ink round it: drawn as it is picked from the whole house, and kept once it is in 3D.
 */
function FloorPlanMarks({
  plan,
  floor,
  name,
  level,
  palette,
  mobile,
  state,
}: {
  plan: HousePlan;
  floor: PlanFloor;
  name: string;
  level: number;
  palette: ModelPalette;
  mobile: boolean;
  state: RefObject<ModelState>;
}) {
  const group = useRef<THREE.Group>(null);
  const gl = useThree(({ gl }) => gl);
  // As the choreography frames it: on a portrait screen, the title block under the floor.
  const portrait = useThree(({ size }) => size.width / Math.max(size.height, 1) < PORTRAIT);
  const make = useCallback(
    (font: string) => {
      const drawing = floorAnnotations(plan, floor, name, portrait);
      const texture = drawSheet(
        drawing,
        { paper: null, fill: palette.background, ink: palette.ink, font },
        mobile ? SHEET_PPM.mobile : SHEET_PPM.desktop,
        gl.capabilities.maxTextureSize,
      );
      if (!texture) return null;
      const mesh = new THREE.Mesh(
        sheetQuad(drawing, level + MARKS_LIFT),
        new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
          depthWrite: false,
          opacity: 0,
          side: THREE.DoubleSide,
        }),
      );
      mesh.renderOrder = 2;
      mesh.visible = false;
      return mesh;
    },
    [plan, floor, name, level, palette, mobile, gl, portrait],
  );
  useSheetMesh(make, group);
  useFrame(() => {
    const pose = poseOf(state.current, floor.id);
    if (pose) showMarks(group.current, pose.plan * pose.opacity);
  });
  return <group ref={group} />;
}

/**
 * The room pointed at in the list beside a picked floor, lit on its floor: a wash of the sweep's
 * glow over it and its outline, over everything in it.
 */
function RoomHighlight({
  plan,
  pointed,
  palette,
  state,
}: {
  plan: HousePlan;
  pointed: RoomKey | null;
  palette: ModelPalette;
  state: RefObject<ModelState>;
}) {
  const group = useRef<THREE.Group>(null);
  const floor = pointed ? plan.floors.find(({ id }) => id === pointed.floor) : undefined;
  const room = floor?.rooms.find(({ id }) => id === pointed?.room);
  const level = floor && floor.kind !== "plot" ? floorLevel(plan, floor.id) : 0;
  const made = useMemo(() => {
    if (!room) return null;
    const { x, z, w, d } = room;
    const wash = new THREE.PlaneGeometry(w, d)
      .rotateX(-Math.PI / 2)
      .translate(x + w / 2, 0, z + d / 2);
    const outline = new THREE.BufferGeometry().setFromPoints(
      [
        [x, z],
        [x + w, z],
        [x + w, z + d],
        [x, z + d],
        [x, z],
      ].map(([px, pz]) => new THREE.Vector3(px, 0, pz)),
    );
    const fill = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.3,
      depthTest: false,
      depthWrite: false,
    });
    const line = new THREE.LineBasicMaterial({ depthTest: false, transparent: true });
    return { wash, outline, fill, line };
  }, [room]);
  useEffect(() => {
    if (!made) return;
    made.fill.color.set(palette.scene.glow);
    made.line.color.set(palette.scene.glow);
  }, [made, palette]);
  useEffect(
    () => () => {
      if (!made) return;
      made.wash.dispose();
      made.outline.dispose();
      made.fill.dispose();
      made.line.dispose();
    },
    [made],
  );
  useFrame(() => {
    const holder = group.current;
    if (!holder) return;
    const pose = floor && poseOf(state.current, floor.id);
    holder.visible = state.current.phase === "floor" && state.current.floor === floor?.id;
    holder.position.y = level + (pose?.lift ?? 0) + 0.12;
  });
  if (!made) return null;
  return (
    <group ref={group}>
      <mesh geometry={made.wash} material={made.fill} renderOrder={3} />
      <lineLoop geometry={made.outline} material={made.line} renderOrder={3} />
    </group>
  );
}

/** The canvas's cursor: a pointer over a room that can be gone into. */
function setPointerCursor(canvas: HTMLCanvasElement, on: boolean) {
  canvas.style.cursor = on ? "pointer" : "";
}

/**
 * The picked floor's rooms to point at and go into, on the canvas: a mouse lights the room under
 * it, with a pointer for a cursor, and a click goes in; a finger's first tap lights it, its second
 * goes in. An unseen plane at the floor's level, through which the pointer finds the room on the
 * plan.
 */
function RoomPicker({
  plan,
  floorId,
  pointed,
  onPoint,
  onEnter,
}: {
  plan: HousePlan;
  floorId: string;
  pointed: string | null;
  onPoint: (room: string | null) => void;
  onEnter: (room: string) => void;
}) {
  const canvas = useThree(({ gl }) => gl.domElement);
  const floor = plan.floors.find(({ id }) => id === floorId);
  const level = floor ? floorLevel(plan, floor.id) : 0;
  const { x, z, w, d } = plan.plot;
  useEffect(() => () => setPointerCursor(canvas, false), [canvas, floorId]);
  if (!floor) return null;
  const under = (event: ThreeEvent<MouseEvent>) =>
    roomUnder(floor, { x: event.point.x, z: event.point.z })?.id ?? null;
  const byMouse = (event: ThreeEvent<MouseEvent>) => {
    const { pointerType } = event.nativeEvent as PointerEvent;
    return pointerType === undefined || pointerType === "mouse" || pointerType === "pen";
  };
  return (
    <mesh
      position={[x + w / 2, level + 0.02, z + d / 2]}
      rotation-x={-Math.PI / 2}
      onPointerMove={(event) => {
        if (!byMouse(event)) return;
        const room = under(event);
        setPointerCursor(canvas, room !== null);
        onPoint(room);
      }}
      onPointerLeave={(event) => {
        if (!byMouse(event)) return;
        setPointerCursor(canvas, false);
        onPoint(null);
      }}
      onClick={(event) => {
        const room = under(event);
        if (room && (byMouse(event) || room === pointed)) onEnter(room);
        else onPoint(room);
      }}
    >
      {/* Well past the plot, so the pointer leaves the rooms before it leaves the plane. */}
      <planeGeometry args={[w + 60, d + 60]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
    </mesh>
  );
}

/** Rooms whose lights are on at dusk: where the house is lived in, not where it is passed through. */
const LIT_ROOMS = new Set(["living", "dining", "kitchen", "bedroom", "hall"]);

/** A light over each lived-in room, at its floor's level, just under its ceiling. */
function roomLights(plan: HousePlan) {
  const built = plan.floors.filter(({ kind }) => kind !== "plot");
  const all = revealRooms(plan);
  return built.flatMap((floor, level) =>
    floor.rooms
      .filter((room) => LIT_ROOMS.has(room.kind) && !room.open)
      .map((room) => ({
        id: `${floor.id}/${room.id}`,
        floor: floor.id,
        index: all.findIndex(({ key }) => key === `${floor.id}/${room.id}`),
        position: new THREE.Vector3(
          room.x + room.w / 2,
          level * STOREY_HEIGHT + 2.2,
          room.z + room.d / 2,
        ),
      })),
  );
}

/** The index of the plot's room of a kind, as the sweep keeps them. */
const plotRoomIndex = (plan: HousePlan, kind: string) =>
  revealRooms(plan).findIndex(({ floor, room }) => floor.kind === "plot" && room.kind === kind);

/**
 * The theme's light on the materials: the sun with its soft shadows and the sky's fill; at dusk,
 * the house's lights and the pool's, each coming on as its room is swept. The paper is lit by the
 * shaders on their own, so none of this changes the drawing.
 */
function SceneLights({
  plan,
  palette,
  mobile,
  state,
}: {
  plan: HousePlan;
  palette: ModelPalette;
  mobile: boolean;
  state: RefObject<ModelState>;
}) {
  const { scene } = palette;
  const plot = plan.plot;
  const centre = new THREE.Vector3(plot.x + plot.w / 2, 0, plot.z + plot.d / 2);
  const reach = Math.max(plot.w, plot.d) / 2 + 4;
  const sun = useRef<THREE.DirectionalLight>(null);
  const rooms = useMemo(() => roomLights(plan), [plan]);
  const roomRefs = useRef<(THREE.PointLight | null)[]>([]);
  const poolRoom = plan.floors
    .find(({ kind }) => kind === "plot")
    ?.rooms.find(({ kind }) => kind === "pool");
  const poolAt = poolRoom
    ? new THREE.Vector3(poolRoom.x + poolRoom.w / 2, -0.9, poolRoom.z + poolRoom.d / 2)
    : null;
  const poolIndex = useMemo(() => plotRoomIndex(plan, "pool"), [plan]);
  const pool = useRef<THREE.PointLight>(null);

  useEffect(() => {
    const light = sun.current;
    if (!light) return;
    light.target.position.copy(centre);
    light.target.updateMatrixWorld();
  });

  useFrame(() => {
    const reveals = state.current.rooms;
    rooms.forEach(({ index, floor }, i) => {
      const light = roomRefs.current[i];
      // A floor lifted out of the way takes its lights with it.
      const shown = poseOf(state.current, floor)?.opacity ?? 1;
      if (light && scene.rooms)
        light.intensity = scene.rooms.intensity * (reveals[index]?.reveal ?? 0) * shown;
    });
    if (pool.current && scene.pool) {
      pool.current.intensity = scene.pool.intensity * (reveals[poolIndex]?.reveal ?? 0);
    }
  });

  return (
    <>
      <hemisphereLight args={[scene.fill.color, scene.fill.ground, scene.fill.intensity]} />
      <directionalLight
        ref={sun}
        position={[
          centre.x + scene.sun.position[0],
          scene.sun.position[1],
          centre.z + scene.sun.position[2],
        ]}
        color={scene.sun.color}
        intensity={scene.sun.intensity}
        castShadow
        shadow-mapSize={mobile ? [1024, 1024] : [2048, 2048]}
        shadow-radius={mobile ? 4 : 6}
        shadow-bias={-0.0004}
        // A coarser map on a phone needs a wider bias, or the walls speckle with their own shadow.
        shadow-normalBias={mobile ? 0.08 : 0.03}
        shadow-camera-left={-reach}
        shadow-camera-right={reach}
        shadow-camera-top={reach}
        shadow-camera-bottom={-reach}
        shadow-camera-near={1}
        shadow-camera-far={140}
      />
      {scene.rooms &&
        rooms.map(({ id, position }, i) => (
          <pointLight
            key={id}
            ref={(light) => {
              roomRefs.current[i] = light;
            }}
            position={position}
            color={scene.rooms!.color}
            intensity={0}
            distance={9}
            decay={2}
          />
        ))}
      {scene.pool && poolAt && (
        <pointLight
          ref={pool}
          position={poolAt}
          color={scene.pool.color}
          intensity={0}
          distance={10}
          decay={2}
        />
      )}
    </>
  );
}

/** The dome round the camera: the paper, until the garden is swept and the sky takes its place. */
function Sky({
  plan,
  palette,
  state,
}: {
  plan: HousePlan;
  palette: ModelPalette;
  state: RefObject<ModelState>;
}) {
  const material = useMemo(() => skyMaterial(), []);
  const garden = useMemo(() => plotRoomIndex(plan, "garden"), [plan]);
  const dome = useRef<THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>>(null);
  const invalidate = useThree(({ invalidate }) => invalidate);
  useEffect(() => () => material.dispose(), [material]);
  useEffect(() => {
    const uniforms = dome.current?.material.uniforms;
    if (!uniforms) return;
    uniforms.uPaper!.value.set(palette.background);
    uniforms.uTop!.value.set(palette.scene.sky.top);
    uniforms.uHorizon!.value.set(palette.scene.sky.horizon);
    invalidate();
  }, [material, palette, invalidate]);
  useFrame(({ camera }) => {
    const sky = dome.current;
    if (!sky) return;
    sky.position.copy(camera.position);
    sky.material.uniforms.uSky!.value = state.current.rooms[garden]?.reveal ?? 0;
  });
  return (
    <mesh ref={dome} material={material} renderOrder={-1} frustumCulled={false}>
      <sphereGeometry args={[300, 32, 16]} />
    </mesh>
  );
}

/** What the scene moves on the occlusion pass (n8ao has no types of its own). */
type OcclusionPass = { enabled: boolean; configuration: { intensity: number } };

/** Ambient occlusion, on desktop only, once a room is in colour. */
function Occlusion({ palette, state }: { palette: ModelPalette; state: RefObject<ModelState> }) {
  const pass = useRef<OcclusionPass>(null);
  useFrame(() => {
    const ao = pass.current;
    if (!ao) return;
    const swept = Math.max(0, ...state.current.rooms.map(({ reveal }) => reveal));
    // Off on paper: the sheet and the descent pay nothing for it.
    ao.enabled = swept > VISIBLE;
    ao.configuration.intensity = palette.scene.occlusion * swept;
  });
  return (
    <EffectComposer multisampling={4}>
      <N8AO
        ref={pass}
        halfRes
        quality="medium"
        aoRadius={1.4}
        distanceFalloff={0.8}
        intensity={0}
        color="black"
      />
    </EffectComposer>
  );
}

/** The near plane inside the house, where a wall can stand a step away. */
const WALK_NEAR = 0.05;

/** The camera the choreography asks for, with a depth range as tight as where it stands allows. */
function CameraRig({
  state,
  hud,
}: {
  state: RefObject<ModelState>;
  hud: RefObject<ShowHud | null>;
}) {
  const target = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera }) => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;
    const { camera: pose, cut } = state.current;
    const { position, fov } = pose;
    // From far above, everything sits in a thin slab under the camera.
    const near = Math.max(WALK_NEAR, (position.y - 14) * 0.6);
    const far = position.y > 60 ? position.y * 1.6 + 500 : 700;
    if (camera.fov !== fov || camera.near !== near || camera.far !== far) {
      camera.fov = fov;
      camera.near = near;
      camera.far = far;
      camera.updateProjectionMatrix();
    }
    camera.position.set(position.x, position.y, position.z);
    camera.lookAt(target.set(pose.target.x, pose.target.y, pose.target.z));
    camera.updateMatrixWorld();
    hud.current?.({ fov, height: position.y, cut: cut >= NO_CUT ? null : cut });
  });
  return null;
}

function House({
  plan,
  name,
  area,
  hud,
  progress,
  palette,
  still,
  floorArea,
  phase,
  mobile,
  request,
  pointed,
  entry,
  entered,
  onPoint,
  onEnter,
}: Omit<HouseModelSceneProps, "onReady">) {
  const state = useChoreography(plan, progress, area, floorArea, still, phase, request, entry);
  return (
    <>
      <Sky plan={plan} palette={palette} state={state} />
      <SceneLights plan={plan} palette={palette} mobile={mobile} state={state} />
      <HouseMesh plan={plan} name={name} palette={palette} mobile={mobile} state={state} />
      <RoomHighlight plan={plan} pointed={pointed} palette={palette} state={state} />
      {request.floor && !entered && (
        <RoomPicker
          plan={plan}
          floorId={request.floor}
          pointed={pointed?.room ?? null}
          onPoint={onPoint}
          onEnter={onEnter}
        />
      )}
      <CameraRig state={state} hud={hud} />
      {!mobile && <Occlusion palette={palette} state={state} />}
    </>
  );
}

export type HouseModelSceneProps = {
  plan: HousePlan;
  /** The house type's name, for the sheet's title block. */
  name: string;
  /** Where the sheet frames the plan on the canvas. */
  area: RefObject<DrawingArea | null>;
  /** Where a floor picked from the whole house is framed: beside its list of rooms. */
  floorArea: RefObject<DrawingArea | null>;
  /** The floor picked from the whole house, if any. */
  request: FloorRequest;
  /** The room pointed at in the picked floor's list or on the canvas, lit in the scene. */
  pointed: RoomKey | null;
  /** A room of the picked floor to go into, or out of. */
  entry: RoomRequest;
  /** The room gone into, if one is: its floor's rooms are no longer pointed at on the canvas. */
  entered: string | null;
  /** A room of the picked floor pointed at on the canvas, or none. */
  onPoint: (room: string | null) => void;
  /** A room of the picked floor clicked, or tapped a second time. */
  onEnter: (room: string) => void;
  /** Shows the camera's lens, height and cut as they change. */
  hud: RefObject<ShowHud | null>;
  /** Scroll progress through the pinned stretch, 0–1, kept up to date by the section. */
  progress: RefObject<number>;
  palette: ModelPalette;
  /** Reduced motion: no easing, every state lands at once. */
  still: boolean;
  /** The phase on screen, which reduced motion only changes once the scene has faded out. */
  phase: ModelPhase;
  /** A phone: a lower resolution, cheaper shadows and no ambient occlusion. */
  mobile: boolean;
  /** Once the scene has drawn. */
  onReady: () => void;
};

/** The canvas. Loaded on its own, without SSR. */
export default function HouseModelScene({ onReady, ...props }: HouseModelSceneProps) {
  const { palette, mobile } = props;
  return (
    <Canvas
      frameloop="demand"
      // No tone mapping: the paper and the ink are the brand's colours.
      flat
      dpr={mobile ? [1, 1.5] : [1, 2]}
      shadows={{ type: THREE.PCFShadowMap }}
      gl={{ antialias: true }}
      camera={{ fov: 2, near: 1, far: 3000 }}
      onCreated={({ gl }) => {
        // The house is cut by a horizontal plane.
        gl.localClippingEnabled = true;
        requestAnimationFrame(() => requestAnimationFrame(onReady));
      }}
      aria-hidden
    >
      <color attach="background" args={[palette.background]} />
      <House {...props} />
    </Canvas>
  );
}
