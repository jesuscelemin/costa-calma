"use client";

import { Line } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer, N8AO, SMAA } from "@react-three/postprocessing";
import { easing } from "maath";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Line2 } from "three-stdlib";

import { houseBounds } from "@/features/houses/plan";
import type { HousePlan } from "@/features/houses/schema";

import {
  modelAt,
  STOREY_HEIGHT,
  type ModelFloorState,
  type ModelState,
} from "../../_lib/model-choreography";
import {
  floorModel,
  plotModel,
  SLAB_DEPTH,
  type Box,
  type FloorModel,
  type InkLine,
} from "../../_lib/model-geometry";
import type { ModelPalette } from "../../_lib/model-palette";

// The house model (ADR 0006): a Three.js scene built from the plan, which eases every frame
// towards the choreography's state for the scroll. It renders on demand: only while the scroll
// moves or the ease has not landed, never at rest. Three.js objects are only touched through refs,
// inside frame callbacks and effects, as the React Compiler rules ask.

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
): RefObject<ModelState> {
  const state = useRef<ModelState>(modelAt(0, plan.floors));
  // The first frame lands where the page already is, instead of easing in from the top.
  const landed = useRef(false);
  // maath keeps each eased value's velocity on its object: the pool needs one that lasts.
  const pool = useRef({ pool: 0 });
  const invalidate = useThree(({ invalidate }) => invalidate);

  useFrame((_, delta) => {
    const target = modelAt(progress.current, plan.floors);
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

type FloorProps = {
  model: FloorModel;
  index: number;
  /** Its height in the closed house. */
  level: number;
  palette: ModelPalette;
  state: RefObject<ModelState>;
  /** Whether its plan is drawn in ink before it is built: the ground floor. */
  inked: boolean;
};

function FloorMesh({ model, index, level, palette, state, inked }: FloorProps) {
  const group = useRef<THREE.Group>(null);
  const built = useRef<THREE.Group>(null);
  const slab = useRef<THREE.MeshStandardMaterial>(null);
  const wall = useRef<THREE.MeshStandardMaterial>(null);
  const glass = useRef<THREE.MeshPhysicalMaterial>(null);
  const joinery = useRef<THREE.MeshStandardMaterial>(null);
  const deck = useRef<THREE.MeshStandardMaterial>(null);
  const planter = useRef<THREE.MeshStandardMaterial>(null);
  const light = useRef<THREE.MeshStandardMaterial>(null);
  const lamp = useRef<THREE.PointLight>(null);

  const geometries = useMemo(
    () => ({
      slabs: boxesGeometry(model.slabs),
      walls: boxesGeometry([...model.walls, ...model.lids, ...model.canopies]),
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
    fade(glass.current, surfaces, palette.glassOpacity);
    const lit = palette.lightsWhenBuilt
      ? Math.max(floor.light, floor.solid * floor.walls)
      : floor.light;
    const on = lit * floor.opacity;
    if (light.current) light.current.emissiveIntensity = on * palette.intensity.panel;
    // Off, a ceiling light seen from above without its ceiling would read as a tile.
    fade(light.current, Math.min(surfaces, on * 4));
    if (lamp.current) lamp.current.intensity = on * palette.intensity.lamp;
  });

  return (
    <group ref={group}>
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
}: {
  plan: HousePlan;
  palette: ModelPalette;
  state: RefObject<ModelState>;
}) {
  const water = useRef<THREE.Mesh>(null);
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
    const mesh = water.current;
    if (!mesh) return;
    const pool = state.current.pool;
    mesh.scale.y = Math.max(pool, 1e-3);
    mesh.visible = pool > VISIBLE;
  });

  return (
    <group>
      {geometries.land && (
        <mesh geometry={geometries.land} receiveShadow>
          <meshStandardMaterial color={palette.land} roughness={1} />
        </mesh>
      )}
      {geometries.basin && (
        <mesh geometry={geometries.basin} receiveShadow>
          <meshStandardMaterial color={palette.basin} roughness={0.6} />
        </mesh>
      )}
      {geometries.water && (
        <mesh ref={water} geometry={geometries.water} position-y={geometries.waterFloor}>
          <meshPhysicalMaterial
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
          <meshStandardMaterial color={palette.deck} roughness={0.7} />
        </mesh>
      )}
      {geometries.pines && (
        <>
          <mesh geometry={geometries.pines.crowns} castShadow>
            <meshStandardMaterial color={palette.foliage} roughness={0.9} flatShading />
          </mesh>
          <mesh geometry={geometries.pines.trunks} castShadow>
            <meshStandardMaterial color={palette.trunk} roughness={0.9} />
          </mesh>
        </>
      )}
    </group>
  );
}

/** The orbit the choreography asks for, framed to the plot and the canvas's shape. */
function CameraRig({ plan, state }: { plan: HousePlan; state: RefObject<ModelState> }) {
  const size = useThree(({ size }) => size);
  const centre = useMemo(() => {
    const { x, z, w, d } = houseBounds(plan);
    return { x: x + w / 2, z: z + d / 2, span: Math.hypot(plan.plot.w, plan.plot.d) };
  }, [plan]);

  useFrame(({ camera }) => {
    const { azimuth, polar, distance, targetY } = state.current.camera;
    // A portrait canvas needs to stand further back to keep the plot's width in view.
    const aspect = size.width / size.height;
    const fit = Math.max(1, 1 / aspect);
    const r = centre.span * 1.8 * distance * fit;
    camera.position.set(
      centre.x + r * Math.sin(polar) * Math.sin(azimuth),
      targetY + r * Math.cos(polar),
      centre.z + r * Math.sin(polar) * Math.cos(azimuth),
    );
    camera.lookAt(centre.x, targetY, centre.z);
  });
  return null;
}

function House({ plan, progress, palette, still }: Omit<HouseModelSceneProps, "onReady">) {
  const state = useChoreography(plan, progress, still);
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
          model: floorModel(plan, floor, plan.floors[index + 1]),
        },
      ];
    });
  }, [plan]);

  return (
    <>
      <Plot plan={plan} palette={palette} state={state} />
      {floors.map(({ id, ...floor }) => (
        <FloorMesh key={id} {...floor} palette={palette} state={state} />
      ))}
      <CameraRig plan={plan} state={state} />
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
};

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
