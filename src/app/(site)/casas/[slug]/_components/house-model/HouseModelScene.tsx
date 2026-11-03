"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { EffectComposer, N8AO } from "@react-three/postprocessing";
import { easing } from "maath";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import type { HousePlan } from "@/features/houses/schema";

import {
  modelAt,
  NO_CUT,
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
import { planSheet } from "../../_lib/plan-sheet";
import { revealRooms, ROOM_BAND, sweepFront, type SweepAxis } from "../../_lib/room-reveal";

import {
  MATERIALS,
  MAX_ROOMS,
  skyMaterial,
  sweepLines,
  sweepMaterial,
  sweepUniforms,
  type MaterialId,
  type SweepMaterial,
  type SweepUniforms,
} from "./model-materials";
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
/** Below this opacity something is not drawn at all. */
const VISIBLE = 0.002;
/** How strong the house's lines are against the cut walls' poché, which stays the darkest. */
const EDGE_OPACITY = 0.55;

/** Several boxes as one geometry. */
function boxesGeometry(boxes: readonly Box[]) {
  return boxes.map(({ x, y, z, w, h, d }) =>
    new THREE.BoxGeometry(w, h, d).translate(x + w / 2, y + h / 2, z + d / 2),
  );
}

/** Pines: a cone of foliage over a trunk, at each foot. */
function pinesGeometry(feet: readonly { x: number; z: number }[]) {
  const crowns: THREE.BufferGeometry[] = [];
  const trunks: THREE.BufferGeometry[] = [];
  feet.forEach(({ x, z }, i) => {
    const height = 3.4 + (i % 3) * 0.5;
    crowns.push(new THREE.ConeGeometry(1.1, height, 7).translate(x, 1.6 + height / 2, z));
    trunks.push(new THREE.CylinderGeometry(0.12, 0.16, 1.8, 6).translate(x, 0.9, z));
  });
  return { crowns, trunks };
}

const merged = (parts: THREE.BufferGeometry[]) => {
  if (parts.length === 0) return null;
  const geometry = mergeGeometries(parts);
  for (const part of parts) part.dispose();
  return geometry;
};

/** The house and its plot in boxes, each floor at its level, by material; its front door apart. */
function houseGeometry(plan: HousePlan) {
  const built = plan.floors.filter(({ kind }) => kind !== "plot");
  const parts: Record<MaterialId, Box[]> = {
    microcement: [],
    oak: [],
    lime: [],
    stone: [],
    ground: [],
    foliage: [],
    water: [],
    glass: [],
  };
  let entrance: EntranceLeaf | undefined;
  // The ground floor's full-height walls, whose tops the cut shows as the plan's poché.
  const poche: Box[] = [];
  built.forEach((floor, level) => {
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
    parts.lime.push(...lift([...walls, ...model.heads, ...model.lids, ...model.canopies]));
    parts.microcement.push(...lift([...model.slabs, ...model.stair]));
    parts.oak.push(...lift([...model.joinery, ...model.decks]));
    parts.foliage.push(...lift(model.planters));
    parts.glass.push(...lift(model.glass));
    if (level === 0 && model.entrance) entrance = model.entrance;
    if (level === 0)
      poche.push(...model.walls.filter(({ y, h }) => y <= 0 && h >= WALL_HEIGHT - 0.01));
  });
  const plot = plotModel(plan);
  parts.ground.push(...plot.land);
  parts.stone.push(...plot.decks, ...(plot.pool ? [plot.pool.basin, ...plot.pool.walls] : []));
  if (plot.pool) parts.water.push(plot.pool.water);
  const pines = pinesGeometry(plot.pines);

  const faces = Object.fromEntries(
    (Object.keys(parts) as MaterialId[]).map((id) => [
      id,
      merged([
        ...boxesGeometry(parts[id]),
        ...(id === "foliage" ? pines.crowns : id === "oak" ? pines.trunks : []),
      ]),
    ]),
  ) as Record<MaterialId, THREE.BufferGeometry | null>;
  // The drawing's lines: every edge, the glass's included, but not the water's surface.
  const lined = (Object.keys(faces) as MaterialId[]).filter((id) => id !== "water");
  const edges = merged(
    lined.flatMap((id) => (faces[id] ? [new THREE.EdgesGeometry(faces[id], 25)] : [])),
  );
  const caps = merged(
    poche.map(({ x, z, w, d }) =>
      new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2).translate(x + w / 2, 0, z + d / 2),
    ),
  );
  return { faces, edges, entrance, caps };
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

/**
 * The state every part of the scene reads, and the loop that keeps it. What eases is the scroll
 * itself, not the camera's parts: the lens and the distance stay in step however fast it goes.
 */
function useChoreography(
  plan: HousePlan,
  progress: RefObject<number>,
  area: RefObject<DrawingArea | null>,
  still: boolean,
  phase: ModelPhase,
): RefObject<ModelState> {
  const size = useThree(({ size }) => size);
  const state = useRef<ModelState>(modelAt(progress.current, plan, { still }));
  // maath keeps the eased value's velocity on its object.
  const eased = useRef({ progress: progress.current });
  // The first frame lands where the page already is, instead of easing in from the top.
  const landed = useRef(false);
  const invalidate = useThree(({ invalidate }) => invalidate);

  useFrame((_, delta) => {
    const target = progress.current;
    const ease = eased.current;
    if (still || !landed.current) ease.progress = target;
    else easing.damp(ease, "progress", target, EASE, Math.min(delta, 0.05));
    landed.current = true;
    const moving = Math.abs(ease.progress - target) > SETTLED;
    if (!moving) ease.progress = target;
    state.current = modelAt(ease.progress, plan, {
      still,
      screen: screenOf(size, area.current),
    });
    if (moving) invalidate();
  }, -1);

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

type Fadeable = THREE.Material & { opacity: number };

/** Fades a material; an opaque one only turns transparent while it fades, to sort as it should. */
function fade(material: Fadeable | null, opacity: number, resting = 1) {
  if (!material) return;
  material.opacity = resting * opacity;
  const transparent = resting < 1 || opacity < 0.999;
  if (material.transparent !== transparent) {
    material.transparent = transparent;
    material.depthWrite = !transparent;
    material.needsUpdate = true;
  }
  material.visible = opacity > VISIBLE;
}

/** Moves the house's cut to a height. */
function cutAt(plane: THREE.Plane | undefined, height: number) {
  if (plane) plane.constant = height;
}

/** How see-through the glass is once swept. */
const GLASS_OPACITY = 0.32;
const materialIds = Object.keys(MATERIALS) as MaterialId[];

/** The scene's own materials, on the sweep's uniforms they share, cut by one horizontal plane. */
function useSweepMaterials(uniforms: SweepUniforms) {
  const made = useMemo(() => {
    // Keeps what is below the cut: a plan's, as it rises, then the whole house.
    const clipping = [new THREE.Plane(new THREE.Vector3(0, -1, 0), NO_CUT)];
    const materials = Object.fromEntries(
      materialIds.map((id) => [id, sweepMaterial(id, uniforms, clipping)]),
    ) as Record<MaterialId, SweepMaterial>;
    return { materials, lines: sweepLines(uniforms, clipping), clipping };
  }, [uniforms]);
  useEffect(
    () => () => {
      for (const material of Object.values(made.materials)) material.dispose();
      made.lines.dispose();
    },
    [made],
  );
  return made;
}

/** The house's materials and lines, as its group holds them, for frames and effects to move. */
function partsOf(group: THREE.Group | null) {
  const materials = new Map<MaterialId, SweepMaterial>();
  let lines: THREE.LineBasicMaterial | null = null;
  group?.traverse((child) => {
    if (child instanceof THREE.LineSegments) lines = child.material as THREE.LineBasicMaterial;
    else if (child instanceof THREE.Mesh && child.name in MATERIALS) {
      materials.set(child.name as MaterialId, child.material as SweepMaterial);
    }
  });
  const sweep = materials.values().next().value?.userData.sweep;
  return { materials, lines: lines as THREE.LineBasicMaterial | null, sweep };
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
 * The cut walls' tops in ink, as a plan's poché, at the height of the cut while it runs through the
 * ground floor's walls. From straight above, the walls' own inside would lie level with the floor
 * and lose to it.
 */
function Poche({
  caps,
  palette,
  state,
}: {
  caps: THREE.BufferGeometry;
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
    mesh.visible = cut < WALL_HEIGHT;
    mesh.position.y = cut - 0.002;
  });
  return <mesh ref={cap} geometry={caps} material={material} />;
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
  const { materials, lines, clipping } = useSweepMaterials(uniforms);
  const invalidate = useThree(({ invalidate }) => invalidate);
  const gl = useThree(({ gl }) => gl);
  const scene = useThree(({ scene }) => scene);
  const camera = useThree(({ camera }) => camera);
  useEffect(
    () => () => {
      for (const part of [...Object.values(geometry.faces), geometry.edges, geometry.caps]) {
        part?.dispose();
      }
    },
    [geometry],
  );

  // The materials' programs and the shadows', built while the sheet is on screen, for the walk not
  // to stall on them: once with the house in colour, out of sight, then as the choreography has it.
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
    for (const [id, material] of materials) {
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
    lines?.color.set(palette.ink);
    invalidate();
  }, [palette, invalidate, materials]);

  useFrame(() => {
    const current = state.current;
    // The plane and the uniforms are shared by every material: moved once, they move for all.
    const { materials: found } = partsOf(group.current);
    cutAt(found.values().next().value?.clippingPlanes?.[0], current.cut);
    placeFronts(uniforms, plan, current);
    fade(materials.glass, 1, GLASS_OPACITY);
    fade(lines, 1, EDGE_OPACITY);
  });

  return (
    <group ref={group}>
      {materialIds.map((id) => {
        const faces = geometry.faces[id];
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
      {geometry.edges && <lineSegments geometry={geometry.edges} material={lines} />}
      {geometry.caps && <Poche caps={geometry.caps} palette={palette} state={state} />}
      <PlanDrawings
        plan={plan}
        name={name}
        palette={palette}
        mobile={mobile}
        uniforms={uniforms}
        clipping={clipping}
      />
      {geometry.entrance && (
        <FrontDoor leaf={geometry.entrance} material={materials.oak} lines={lines} state={state} />
      )}
    </group>
  );
}

/** How many pixels a metre the sheet is drawn at: sharper on a laptop than on a phone. */
const SHEET_PPM = { desktop: 120, mobile: 72 };
/** How far over its floor a storey's drawing lies, clear of its slab and of its decks. */
const DRAWING_LIFT = 0.07;

/**
 * Each storey's drawing on its floor: the ground floor's the whole sheet, on its paper; the ones
 * above, their ink. They go room by room with the sweep, and are cut with the house.
 */
function PlanDrawings({
  plan,
  name,
  palette,
  mobile,
  uniforms,
  clipping,
}: {
  plan: HousePlan;
  name: string;
  palette: ModelPalette;
  mobile: boolean;
  uniforms: SweepUniforms;
  clipping: THREE.Plane[];
}) {
  const group = useRef<THREE.Group>(null);
  const gl = useThree(({ gl }) => gl);
  const invalidate = useThree(({ invalidate }) => invalidate);
  useEffect(() => {
    const holder = group.current;
    if (!holder) return;
    let cancelled = false;
    const made: THREE.Mesh[] = [];
    void document.fonts.ready.then(() => {
      if (cancelled) return;
      const font = getComputedStyle(document.body).fontFamily;
      const storeys = plan.floors.filter(({ kind }) => kind !== "plot");
      storeys.forEach((floor, index) => {
        const drawing = planSheet(plan, floor, name);
        const texture = drawSheet(
          drawing,
          {
            paper: index === 0 ? palette.background : null,
            fill: index === 0 ? palette.background : palette.paper,
            ink: palette.ink,
            font,
          },
          mobile ? SHEET_PPM.mobile : SHEET_PPM.desktop,
          gl.capabilities.maxTextureSize,
        );
        if (!texture) return;
        const level = index * STOREY_HEIGHT;
        const mesh = new THREE.Mesh(
          sheetQuad(drawing, level + DRAWING_LIFT),
          drawingMaterial(texture, uniforms, clipping),
        );
        mesh.renderOrder = 1;
        holder.add(mesh);
        made.push(mesh);
      });
      invalidate();
    });
    return () => {
      cancelled = true;
      for (const mesh of made) {
        holder.remove(mesh);
        mesh.geometry.dispose();
        const material = mesh.material as THREE.MeshBasicMaterial;
        material.map?.dispose();
        material.dispose();
      }
    };
  }, [plan, name, palette, mobile, uniforms, clipping, gl, invalidate]);
  return <group ref={group} />;
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
    rooms.forEach(({ index }, i) => {
      const light = roomRefs.current[i];
      if (light && scene.rooms)
        light.intensity = scene.rooms.intensity * (reveals[index]?.reveal ?? 0);
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
  phase,
  mobile,
}: Omit<HouseModelSceneProps, "onReady">) {
  const state = useChoreography(plan, progress, area, still, phase);
  return (
    <>
      <Sky plan={plan} palette={palette} state={state} />
      <SceneLights plan={plan} palette={palette} mobile={mobile} state={state} />
      <HouseMesh plan={plan} name={name} palette={palette} mobile={mobile} state={state} />
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
