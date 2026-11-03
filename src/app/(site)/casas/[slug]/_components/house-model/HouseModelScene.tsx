"use client";

import { Html, Line } from "@react-three/drei";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Bloom, EffectComposer, N8AO, SMAA } from "@react-three/postprocessing";
import { easing } from "maath";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Line2 } from "three-stdlib";

import { floorGeometry, houseBounds, type RoomGeometry } from "@/features/houses/plan";
import type { HousePlan, PlanFloor, Rect } from "@/features/houses/schema";
import { formatArea } from "@/lib/format";

import { modelAt, type ModelFloorState, type ModelState } from "../../_lib/model-choreography";
import {
  floorModel,
  plotModel,
  SLAB_DEPTH,
  STOREY_HEIGHT,
  type Box,
  type FloorModel,
  type InkLine,
} from "../../_lib/model-geometry";
import type { ModelPalette } from "../../_lib/model-palette";

// The house model (ADR 0006): a Three.js scene built from the plan, which eases every frame
// towards the choreography's state for the scroll. It renders on demand: only while the scroll
// moves or the ease has not landed, never at rest. Three.js objects are only touched through refs,
// inside frame callbacks and effects, as the React Compiler rules ask.

/** What the visitor does with the house: the floor picked, the room pointed at. */
type Focus = {
  /** The floor shown alone, as an index into the plan's floors. */
  picked: number | null;
  pointedRoom: string | null;
  onPick: (index: number) => void;
  onPointRoom: (id: string | null) => void;
};

/** Seconds the ease takes to cover most of the way to its target. */
const EASE = 0.22;
/** Closer than this the ease has landed, and the scene stops rendering. */
const SETTLED = 1e-3;
/** Below this opacity or height something is not drawn at all. */
const VISIBLE = 0.002;

/** Several boxes as one geometry: one draw call per material and floor. */
function boxesGeometry(boxes: readonly Box[]) {
  if (boxes.length === 0) return null;
  const parts = boxes.map(({ x, y, z, w, h, d }) =>
    new THREE.BoxGeometry(w, h, d).translate(x + w / 2, y + h / 2, z + d / 2),
  );
  const merged = mergeGeometries(parts);
  for (const part of parts) part.dispose();
  return merged;
}

/** Pines: a cone of foliage over a trunk, at each foot. */
function pinesGeometry(feet: readonly { x: number; z: number }[]) {
  if (feet.length === 0) return null;
  const crowns = feet.map(({ x, z }, i) => {
    const height = 3.4 + (i % 3) * 0.5;
    return new THREE.ConeGeometry(1.1, height, 7).translate(x, 1.6 + height / 2, z);
  });
  const trunks = feet.map(({ x, z }) =>
    new THREE.CylinderGeometry(0.12, 0.16, 1.8, 6).translate(x, 0.9, z),
  );
  return {
    crowns: mergeGeometries(crowns),
    trunks: mergeGeometries(trunks),
    dispose: () => [...crowns, ...trunks].forEach((part) => part.dispose()),
  };
}

/** Releases geometries made by hand when they change or the scene goes. */
function useDisposed(geometries: readonly (THREE.BufferGeometry | null)[]) {
  useEffect(() => () => geometries.forEach((geometry) => geometry?.dispose()), [geometries]);
}

const sameState = (a: number, b: number) => Math.abs(a - b) < SETTLED;

/** The eased state every part of the scene reads, and the loop that eases it. */
function useChoreography(
  plan: HousePlan,
  progress: RefObject<number>,
  still: boolean,
  focus: { picked: number | null; pointed: RefObject<number | null> },
): RefObject<ModelState> {
  const state = useRef<ModelState>(modelAt(0, plan.floors));
  // The first frame lands where the page already is, instead of easing in from the top.
  const landed = useRef(false);
  // maath keeps each eased value's velocity on its object: the pool needs one that lasts.
  const pool = useRef({ pool: 0 });
  const invalidate = useThree(({ invalidate }) => invalidate);

  useFrame((_, delta) => {
    const target = modelAt(progress.current, plan.floors, {
      picked: focus.picked,
      pointed: focus.pointed.current,
    });
    const current = state.current;
    const dt = Math.min(delta, 0.05);
    const snap = still || !landed.current;
    landed.current = true;
    const ease = (from: Record<string, number>, to: Record<string, number>) => {
      let moving = false;
      for (const key of Object.keys(to)) {
        if (snap) from[key] = to[key]!;
        else easing.damp(from, key, to[key]!, EASE, dt);
        if (!sameState(from[key]!, to[key]!)) moving = true;
        else from[key] = to[key]!;
      }
      return moving;
    };
    let moving = ease(current.camera, target.camera);
    current.floors.forEach((floor, index) => {
      if (ease(floor, target.floors[index]!)) moving = true;
    });
    if (ease(pool.current, { pool: target.pool })) moving = true;
    current.pool = pool.current.pool;
    current.phase = target.phase;
    if (moving) invalidate();
  }, -1);

  // Picking a floor moves the target too.
  useEffect(() => invalidate(), [invalidate, focus.picked]);

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

/** The ink plan: wall lines drawn one after another as `plan` grows, and the doors' swings. */
function InkPlan({
  ink,
  palette,
  state,
  index,
}: {
  ink: FloorModel["ink"];
  palette: ModelPalette;
  state: RefObject<ModelState>;
  index: number;
}) {
  const walls = useRef<THREE.InstancedMesh>(null);
  const wallMaterial = useRef<THREE.MeshBasicMaterial>(null);
  const swings = useRef<Line2>(null);
  const dummy = useRef(new THREE.Object3D());
  const lines: InkLine[] = useMemo(() => [...ink.walls, ...ink.windows], [ink]);
  const segments = useMemo(
    () =>
      [
        ...ink.swings.flatMap((points) =>
          points.slice(1).flatMap((point, i) => [points[i]!, point]),
        ),
        // Windows and sliding doors as a line across their gap.
        ...ink.windows.flatMap(({ x1, z1, x2, z2 }) => [
          { x: x1, z: z1 },
          { x: x2, z: z2 },
        ]),
      ].map(({ x, z }) => new THREE.Vector3(x, 0.03, z)),
    [ink],
  );

  useFrame(() => {
    const floor: ModelFloorState | undefined = state.current.floors[index];
    const mesh = walls.current;
    if (!floor || !mesh) return;
    const visible = floor.plan * (1 - floor.solid) * floor.opacity;
    fade(wallMaterial.current, visible);
    const material = swings.current?.material;
    if (material) {
      material.opacity = visible * Math.max(0, (floor.plan - 0.5) * 2);
      material.visible = material.opacity > VISIBLE;
    }
    // Each line starts once those before it are well on their way.
    const count = lines.length;
    lines.forEach(({ x1, z1, x2, z2 }, i) => {
      const drawn = Math.min(Math.max((floor.plan - (0.7 * i) / count) / 0.3, 0), 1);
      const length = Math.hypot(x2 - x1, z2 - z1) * drawn;
      const angle = Math.atan2(z2 - z1, x2 - x1);
      const object = dummy.current;
      object.position.set(
        x1 + (Math.cos(angle) * length) / 2,
        0.02,
        z1 + (Math.sin(angle) * length) / 2,
      );
      object.rotation.set(0, -angle, 0);
      object.scale.set(Math.max(length, 1e-4), 1, 1);
      object.updateMatrix();
      mesh.setMatrixAt(i, object.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={walls} args={[undefined, undefined, lines.length]} frustumCulled={false}>
        <boxGeometry args={[1, 0.02, 0.12]} />
        <meshBasicMaterial ref={wallMaterial} color={palette.ink} transparent />
      </instancedMesh>
      {segments.length > 0 && (
        <Line
          ref={swings}
          points={segments}
          segments
          color={palette.ink}
          lineWidth={1.25}
          transparent
          opacity={0}
        />
      )}
    </group>
  );
}

/** Where a room's label goes: its middle, or the garden's strip behind the house. */
function labelAnchor(room: RoomGeometry, plan: HousePlan) {
  const z = room.kind === "garden" ? (room.z + houseBounds(plan).z) / 2 : room.z + room.d / 2;
  return { x: room.x + room.w / 2, z };
}

/** A picked floor's rooms: lit when pointed at or touched, with their labels over them. */
function Rooms({
  plan,
  floor,
  index,
  palette,
  state,
  focus,
}: {
  plan: HousePlan;
  floor: PlanFloor;
  index: number;
  palette: ModelPalette;
  state: RefObject<ModelState>;
  focus: Focus;
}) {
  const labels = useRef<(HTMLDivElement | null)[]>([]);
  const rooms = useMemo(
    () =>
      floorGeometry(floor, plan).rooms.filter(({ kind }) => kind !== "void" && kind !== "stair"),
    [floor, plan],
  );
  const { pointedRoom, onPointRoom } = focus;

  useFrame(() => {
    const shown = state.current.floors[index]?.labels ?? 0;
    for (const label of labels.current) if (label) label.style.opacity = String(shown);
  });

  const point = (id: string | null) => (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    onPointRoom(id);
  };
  // A touch has no pointer to leave with: a second tap puts the room out.
  const toggle = (id: string) => (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onPointRoom(pointedRoom === id ? null : id);
  };

  return (
    <group>
      {rooms.map((room, i) => {
        const { x, z } = labelAnchor(room, plan);
        const pointed = pointedRoom === room.id;
        // The garden runs under everything else on the plot: the rest lie just over it.
        const y = room.kind === "garden" ? 0.02 : 0.08;
        return (
          <group key={room.id}>
            <mesh
              position={[room.x + room.w / 2, y, room.z + room.d / 2]}
              rotation-x={-Math.PI / 2}
              onPointerOver={point(room.id)}
              onPointerOut={point(null)}
              onClick={toggle(room.id)}
            >
              <planeGeometry args={[room.w, room.d]} />
              <meshBasicMaterial
                color={palette.light}
                transparent
                opacity={pointed ? 0.35 : 0}
                depthWrite={false}
                toneMapped={false}
              />
            </mesh>
            <Html position={[x, 1, z]} center zIndexRange={[20, 0]} pointerEvents="none">
              <div
                ref={(element) => {
                  labels.current[i] = element;
                }}
                data-room-label={room.id}
                data-pointed={pointed || undefined}
                className="flex max-w-32 flex-col items-center rounded-md border border-line bg-surface-raised/90 px-1.5 py-0.5 text-center text-balance opacity-0 transition-colors data-pointed:border-terracota-text data-pointed:bg-terracota-soft motion-reduce:transition-none md:max-w-none md:px-2 md:whitespace-nowrap"
              >
                <span className="text-xs leading-4 font-semibold text-ink md:type-small">
                  {room.name}
                </span>
                {/* On phones, the name alone. */}
                <span className="hidden text-xs leading-4 text-ink-muted tabular-nums md:block">
                  {formatArea(room.area)} · {room.orientation.toLowerCase()}
                </span>
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
}

type FloorProps = {
  model: FloorModel;
  index: number;
  /** Its height in the closed house. */
  level: number;
  palette: ModelPalette;
  state: RefObject<ModelState>;
  /** Whether its plan is drawn in ink before it is built: the ground floor. */
  inked: boolean;
  plan: HousePlan;
  floor: PlanFloor;
  focus: Focus;
  /** The pointer comes onto the floor (true) or leaves it, for the choreography to lift it. */
  onPoint: (on: boolean) => void;
};

function FloorMesh({
  model,
  index,
  level,
  palette,
  state,
  inked,
  plan,
  floor: planFloor,
  focus,
  onPoint,
}: FloorProps) {
  const group = useRef<THREE.Group>(null);
  const built = useRef<THREE.Group>(null);
  const slab = useRef<THREE.MeshStandardMaterial>(null);
  const wall = useRef<THREE.MeshStandardMaterial>(null);
  const head = useRef<THREE.MeshStandardMaterial>(null);
  const glass = useRef<THREE.MeshPhysicalMaterial>(null);
  const joinery = useRef<THREE.MeshStandardMaterial>(null);
  const deck = useRef<THREE.MeshStandardMaterial>(null);
  const planter = useRef<THREE.MeshStandardMaterial>(null);
  const light = useRef<THREE.MeshStandardMaterial>(null);
  const lamp = useRef<THREE.PointLight>(null);

  const geometries = useMemo(
    () => ({
      slabs: boxesGeometry(model.slabs),
      walls: boxesGeometry(model.walls),
      heads: boxesGeometry([...model.heads, ...model.lids, ...model.canopies]),
      glass: boxesGeometry(model.glass),
      joinery: boxesGeometry(model.joinery),
      decks: boxesGeometry(model.decks),
      planters: boxesGeometry(model.planters),
      lights: boxesGeometry(model.lights),
    }),
    [model],
  );
  useDisposed(useMemo(() => Object.values(geometries), [geometries]));

  useFrame(() => {
    const floor = state.current.floors[index];
    if (!floor || !group.current || !built.current) return;
    group.current.position.y = level + floor.lift;
    group.current.visible = floor.opacity > VISIBLE;
    built.current.scale.y = Math.max(floor.walls, 1e-3);
    built.current.visible = floor.walls > VISIBLE;
    const surfaces = floor.opacity * floor.solid;
    // The slab comes first, as the paper the plan is drawn on.
    fade(slab.current, floor.opacity * floor.plan);
    for (const material of [wall, joinery, deck, planter]) fade(material.current, surfaces);
    fade(head.current, surfaces * (1 - floor.cut));
    fade(glass.current, surfaces, palette.glassOpacity);
    const lit = palette.lightsWhenBuilt
      ? Math.max(floor.light, floor.solid * floor.walls)
      : floor.light;
    const on = lit * floor.opacity;
    if (light.current) light.current.emissiveIntensity = on * palette.intensity.panel;
    // Off, a ceiling light seen from above without its ceiling would read as a tile.
    fade(light.current, Math.min(surfaces, on * 4) * (1 - floor.cut));
    // Brought down with its walls, the lamp would glare into a camera looking from above.
    if (lamp.current) lamp.current.intensity = on * palette.intensity.lamp * (1 - 0.75 * floor.cut);
  });

  // In the open house, a floor lifts under the pointer and a click picks it.
  const pickable = () => {
    const current = state.current;
    return (
      focus.picked === null &&
      current.phase === "open" &&
      (current.floors[index]?.opacity ?? 0) > 0.5
    );
  };
  const picked = focus.picked === index;

  return (
    <group
      ref={group}
      onPointerOver={(event) => {
        event.stopPropagation();
        if (pickable()) onPoint(true);
      }}
      onPointerOut={() => onPoint(false)}
      onClick={(event) => {
        if (!pickable()) return;
        event.stopPropagation();
        onPoint(false);
        focus.onPick(index);
      }}
    >
      {picked && (
        <Rooms
          plan={plan}
          floor={planFloor}
          index={index}
          palette={palette}
          state={state}
          focus={focus}
        />
      )}
      {geometries.slabs && (
        <mesh geometry={geometries.slabs} castShadow receiveShadow>
          <meshStandardMaterial ref={slab} color={palette.slab} roughness={0.75} />
        </mesh>
      )}
      {geometries.decks && (
        <mesh geometry={geometries.decks} receiveShadow>
          <meshStandardMaterial ref={deck} color={palette.deck} roughness={0.7} />
        </mesh>
      )}
      {inked && <InkPlan ink={model.ink} palette={palette} state={state} index={index} />}
      <group ref={built}>
        {geometries.walls && (
          <mesh geometry={geometries.walls} castShadow receiveShadow>
            <meshStandardMaterial ref={wall} color={palette.wall} roughness={0.85} />
          </mesh>
        )}
        {geometries.heads && (
          <mesh geometry={geometries.heads} castShadow receiveShadow>
            <meshStandardMaterial ref={head} color={palette.wall} roughness={0.85} />
          </mesh>
        )}
        {geometries.glass && (
          <mesh geometry={geometries.glass}>
            <meshPhysicalMaterial
              ref={glass}
              color={palette.glass}
              roughness={0.05}
              transparent
              opacity={0.25}
              depthWrite={false}
            />
          </mesh>
        )}
        {geometries.joinery && (
          <mesh geometry={geometries.joinery} castShadow>
            <meshStandardMaterial ref={joinery} color={palette.joinery} roughness={0.5} />
          </mesh>
        )}
        {geometries.planters && (
          <mesh geometry={geometries.planters} castShadow receiveShadow>
            <meshStandardMaterial ref={planter} color={palette.foliage} roughness={1} />
          </mesh>
        )}
        {geometries.lights && (
          <mesh geometry={geometries.lights}>
            <meshStandardMaterial
              ref={light}
              color={palette.light}
              emissive={palette.light}
              emissiveIntensity={0}
              toneMapped={false}
            />
          </mesh>
        )}
        {model.lamp && (
          <pointLight
            ref={lamp}
            position={[model.lamp.x, 2.2, model.lamp.z]}
            color={palette.light}
            distance={14}
            decay={1.6}
            intensity={0}
          />
        )}
      </group>
    </group>
  );
}

function Plot({
  plan,
  palette,
  state,
  focus,
  onPoint,
}: {
  plan: HousePlan;
  palette: ModelPalette;
  state: RefObject<ModelState>;
  focus: Focus;
  /** The pointer comes onto the land (true) or leaves it: a click on it picks the Exterior. */
  onPoint: (on: boolean) => void;
}) {
  const index = plan.floors.findIndex(({ kind }) => kind === "plot");
  const group = useRef<THREE.Group>(null);
  const water = useRef<THREE.Mesh>(null);
  const waterMaterial = useRef<THREE.MeshPhysicalMaterial>(null);
  const land = useRef<THREE.MeshStandardMaterial>(null);
  const basin = useRef<THREE.MeshStandardMaterial>(null);
  const deck = useRef<THREE.MeshStandardMaterial>(null);
  const crowns = useRef<THREE.MeshStandardMaterial>(null);
  const trunks = useRef<THREE.MeshStandardMaterial>(null);
  const geometries = useMemo(() => {
    const model = plotModel(plan);
    const pool = model.pool;
    return {
      land: boxesGeometry(model.land),
      basin: pool ? boxesGeometry([pool.basin, ...pool.walls]) : null,
      // The water from its own floor up, so filling the pool is scaling it.
      water: pool ? boxesGeometry([{ ...pool.water, y: 0 }]) : null,
      waterFloor: pool?.water.y ?? 0,
      decks: boxesGeometry(model.decks),
      pines: pinesGeometry(model.pines),
    };
  }, [plan]);
  useDisposed(
    useMemo(
      () => [
        geometries.land,
        geometries.basin,
        geometries.water,
        geometries.decks,
        geometries.pines?.crowns ?? null,
        geometries.pines?.trunks ?? null,
      ],
      [geometries],
    ),
  );
  useEffect(() => () => geometries.pines?.dispose(), [geometries]);

  useFrame(() => {
    const plot = state.current.floors[index];
    if (plot && group.current) {
      group.current.position.y = plot.lift;
      group.current.visible = plot.opacity > VISIBLE;
      for (const each of [land, basin, deck, crowns, trunks]) fade(each.current, plot.opacity);
      fade(waterMaterial.current, plot.opacity, 0.9);
    }
    const mesh = water.current;
    if (!mesh) return;
    const pool = state.current.pool;
    mesh.scale.y = Math.max(pool, 1e-3);
    mesh.visible = pool > VISIBLE;
  });

  const plotFloor = plan.floors[index];
  // Under the open house the land is the Exterior: the floors over it take the pointer first.
  const pickable = () => focus.picked === null && state.current.phase === "open";
  return (
    <group
      ref={group}
      onPointerOver={(event) => {
        event.stopPropagation();
        if (pickable()) onPoint(true);
      }}
      onPointerOut={() => onPoint(false)}
      onClick={(event) => {
        if (!pickable()) return;
        event.stopPropagation();
        onPoint(false);
        focus.onPick(index);
      }}
    >
      {plotFloor && focus.picked === index && (
        <Rooms
          plan={plan}
          floor={plotFloor}
          index={index}
          palette={palette}
          state={state}
          focus={focus}
        />
      )}
      {geometries.land && (
        <mesh geometry={geometries.land} receiveShadow>
          <meshStandardMaterial ref={land} color={palette.land} roughness={1} />
        </mesh>
      )}
      {geometries.basin && (
        <mesh geometry={geometries.basin} receiveShadow>
          <meshStandardMaterial ref={basin} color={palette.basin} roughness={0.6} />
        </mesh>
      )}
      {geometries.water && (
        <mesh ref={water} geometry={geometries.water} position-y={geometries.waterFloor}>
          <meshPhysicalMaterial
            ref={waterMaterial}
            color={palette.water}
            roughness={0.08}
            emissive={palette.water}
            emissiveIntensity={palette.intensity.water}
            clearcoat={1}
            transparent
            opacity={0.9}
          />
        </mesh>
      )}
      {geometries.decks && (
        <mesh geometry={geometries.decks} receiveShadow castShadow>
          <meshStandardMaterial ref={deck} color={palette.deck} roughness={0.7} />
        </mesh>
      )}
      {geometries.pines && (
        <>
          <mesh geometry={geometries.pines.crowns} castShadow>
            <meshStandardMaterial
              ref={crowns}
              color={palette.foliage}
              roughness={0.9}
              flatShading
            />
          </mesh>
          <mesh geometry={geometries.pines.trunks} castShadow>
            <meshStandardMaterial ref={trunks} color={palette.trunk} roughness={0.9} />
          </mesh>
        </>
      )}
    </group>
  );
}

/** The rectangle that holds these. */
function enclosing(rects: readonly Rect[]): Rect {
  const x = Math.min(...rects.map((rect) => rect.x));
  const z = Math.min(...rects.map((rect) => rect.z));
  const w = Math.max(...rects.map((rect) => rect.x + rect.w)) - x;
  const d = Math.max(...rects.map((rect) => rect.z + rect.d)) - z;
  return { x, z, w, d };
}

const middle = ({ x, z, w, d }: Rect) => ({ x: x + w / 2, z: z + d / 2 });

/**
 * The orbit the choreography asks for, framed to the plot and the canvas's shape, around the
 * house, the floor picked or the plot.
 */
function CameraRig({
  plan,
  state,
  picked,
  still,
}: {
  plan: HousePlan;
  state: RefObject<ModelState>;
  picked: number | null;
  still: boolean;
}) {
  const size = useThree(({ size }) => size);
  const span = Math.hypot(plan.plot.w, plan.plot.d);
  const centres = useMemo(() => {
    const house = middle(houseBounds(plan));
    return {
      house,
      floors: plan.floors.map((floor) =>
        floor.kind === "plot" ? middle(plan.plot) : middle(enclosing(floor.rooms)),
      ),
    };
  }, [plan]);
  const centre = useRef({ ...centres.house });

  useFrame(({ camera }, delta) => {
    const target = (picked !== null && centres.floors[picked]) || centres.house;
    if (still) Object.assign(centre.current, target);
    else {
      easing.damp(centre.current, "x", target.x, EASE, Math.min(delta, 0.05));
      easing.damp(centre.current, "z", target.z, EASE, Math.min(delta, 0.05));
    }
    const { azimuth, polar, distance, targetY } = state.current.camera;
    // A portrait canvas needs to stand further back to keep the plot's width in view.
    const aspect = size.width / size.height;
    const fit = Math.max(1, 1 / aspect);
    const r = span * 1.8 * distance * fit;
    const { x, z } = centre.current;
    camera.position.set(
      x + r * Math.sin(polar) * Math.sin(azimuth),
      targetY + r * Math.cos(polar),
      z + r * Math.sin(polar) * Math.cos(azimuth),
    );
    camera.lookAt(x, targetY, z);
  });
  return null;
}

function House({
  plan,
  progress,
  palette,
  still,
  picked,
  pointedRoom,
  onPick,
  onPointRoom,
}: Omit<HouseModelSceneProps, "onReady">) {
  const pointed = useRef<number | null>(null);
  const state = useChoreography(plan, progress, still, { picked, pointed });
  const focus: Focus = { picked, pointedRoom, onPick, onPointRoom };
  const plotIndex = plan.floors.findIndex(({ kind }) => kind === "plot");
  const invalidate = useThree(({ invalidate }) => invalidate);
  const get = useThree(({ get }) => get);
  /** The pointer comes onto a floor or leaves it: the floor lifts, and the cursor says it picks. */
  const pointFloor = (index: number, on: boolean) => {
    if (!on && pointed.current !== index) return;
    pointed.current = on ? index : null;
    get().gl.domElement.style.cursor = on ? "pointer" : "";
    invalidate();
  };
  const floors = useMemo(() => {
    const built = plan.floors.filter(({ kind }) => kind !== "plot");
    return plan.floors.flatMap((floor, index) => {
      if (floor.kind === "plot") return [];
      const level = built.indexOf(floor);
      return [
        {
          id: floor.id,
          index,
          // On a plinth as deep as a slab, so the ground floor's slab stands clear of the land.
          level: SLAB_DEPTH + level * STOREY_HEIGHT,
          inked: level === 0,
          floor,
          model: floorModel(plan, floor, plan.floors[index + 1]),
        },
      ];
    });
  }, [plan]);

  return (
    <>
      <Plot
        plan={plan}
        palette={palette}
        state={state}
        focus={focus}
        onPoint={(on) => pointFloor(plotIndex, on)}
      />
      {floors.map(({ id, ...floor }) => (
        <FloorMesh
          key={id}
          {...floor}
          plan={plan}
          palette={palette}
          state={state}
          focus={focus}
          onPoint={(on) => pointFloor(floor.index, on)}
        />
      ))}
      <CameraRig plan={plan} state={state} picked={picked} still={still} />
    </>
  );
}

export type HouseModelSceneProps = {
  plan: HousePlan;
  /** Scroll progress through the pinned stretch, 0–1, kept up to date by the section. */
  progress: RefObject<number>;
  palette: ModelPalette;
  /** Reduced motion: no easing, every state lands at once. */
  still: boolean;
  /** Once the scene has drawn, for the poster to go. */
  onReady: () => void;
} & Focus;

/** The canvas with its lights and its finish. Loaded on its own, without SSR. */
export default function HouseModelScene({ onReady, ...props }: HouseModelSceneProps) {
  const { palette } = props;
  return (
    <Canvas
      frameloop="demand"
      // R3F's default, PCFSoftShadowMap, is gone from three: it warns and falls back to PCF.
      shadows="percentage"
      dpr={[1, 1.75]}
      gl={{ antialias: false, powerPreference: "high-performance" }}
      camera={{ fov: 30, near: 1, far: 400 }}
      onCreated={() => requestAnimationFrame(onReady)}
      aria-hidden
    >
      <color attach="background" args={[palette.background]} />
      <hemisphereLight
        args={[palette.sky, palette.groundLight]}
        intensity={palette.intensity.sky}
      />
      <directionalLight
        position={[-18, 30, 22]}
        intensity={palette.intensity.sun}
        color={palette.sun}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        shadow-camera-near={1}
        shadow-camera-far={90}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
      />
      <House {...props} />
      <EffectComposer multisampling={0}>
        {/* Ambient occlusion only by day: by night it greys the background against the page. */}
        {!palette.occlusion ? (
          <></>
        ) : (
          <N8AO halfRes aoRadius={1.2} intensity={2} distanceFalloff={0.8} />
        )}
        <Bloom mipmapBlur luminanceThreshold={1} intensity={palette.intensity.bloom} levels={6} />
        <SMAA />
      </EffectComposer>
    </Canvas>
  );
}
