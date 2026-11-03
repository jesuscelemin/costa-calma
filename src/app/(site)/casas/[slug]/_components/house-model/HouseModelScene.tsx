"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { EffectComposer, N8AO } from "@react-three/postprocessing";
import { easing } from "maath";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import type { HousePlan, SectionPlane } from "@/features/houses/schema";

import type { HouseSection } from "../../_lib/house-section";
import { modelAt, type ModelPhase, type ModelState } from "../../_lib/model-choreography";
import { floorModel, plotModel, STOREY_HEIGHT, type Box } from "../../_lib/model-geometry";
import type { ModelPalette } from "../../_lib/model-palette";
import { sectionFrame, sectionViewBox, type SectionFrameId } from "../SectionDrawing";

import {
  MATERIALS,
  skyMaterial,
  sweepLines,
  sweepMaterial,
  sweepUniforms,
  type MaterialId,
  type SweepMaterial,
} from "./model-materials";
import { SHEET_PX_PER_METRE, type PlaceSheet, type SheetWipe } from "./SectionSheet";

// The house model (ADR 0009): a Three.js scene that eases every frame towards the choreography's
// state for the scroll. It starts as the corte's own SVG, the sheet over the canvas, set on the
// plane the house is cut by and seen square on, framed exactly as the poster draws it. As the lens
// opens the camera turns off the cut, and the house behind the plane, cut by it, rises from the
// paper in ink. Then the sweep crosses the corte, wiping the sheet and turning the house's paper
// into its materials under the theme's light (model-materials.ts). It renders on demand: only
// while the scroll moves or the ease has not landed, never at rest. Three.js objects are only
// touched through refs, inside frame callbacks and effects, as the React Compiler rules ask: hence
// `partsOf`, which finds the house's materials on its group rather than in what made them.

/** Where the drawing goes on the canvas, in CSS px from its top left corner. */
export type DrawingArea = { left: number; top: number; width: number; height: number };

/** Seconds the ease takes to cover most of the way to its target. */
const EASE = 0.3;
/** Closer than this the ease has landed, and the scene stops rendering. */
const SETTLED = 1e-4;
/** Below this opacity something is not drawn at all. */
const VISIBLE = 0.002;
/** How strong the house's lines are against the corte's poché, which stays the darkest. */
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

/** The house and its plot in boxes, each floor at its level as the corte stands them, by material. */
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
  built.forEach((floor, level) => {
    const model = floorModel(plan, floor, { next: built[level + 1], below: built[level - 1] });
    const lift = (boxes: Box[]) =>
      boxes.map((box) => ({ ...box, y: box.y + level * STOREY_HEIGHT }));
    parts.lime.push(...lift([...model.walls, ...model.heads, ...model.lids, ...model.canopies]));
    parts.microcement.push(...lift([...model.slabs, ...model.stair]));
    parts.oak.push(...lift([...model.joinery, ...model.decks]));
    parts.foliage.push(...lift(model.planters));
    parts.glass.push(...lift(model.glass));
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
  return { faces, edges };
}

/**
 * The cut as Three.js clips: what stands on the camera's side of the plane goes. A north–south
 * cut is seen from the west, an east–west one from the south.
 */
function clippingPlane({ runs, at }: SectionPlane) {
  return runs === "north-south"
    ? new THREE.Plane(new THREE.Vector3(1, 0, 0), -at)
    : new THREE.Plane(new THREE.Vector3(0, 0, -1), at);
}

/** A point given across the cut (`n`, towards the camera), along it (`u`) and up, in the world. */
function toWorld({ runs, at }: SectionPlane, n: number, u: number, y: number) {
  return runs === "north-south" ? new THREE.Vector3(at - n, y, u) : new THREE.Vector3(u, y, at + n);
}

/** The eased state every part of the scene reads, and the loop that eases it. */
function useChoreography(
  plan: HousePlan,
  progress: RefObject<number>,
  still: boolean,
  phase: ModelPhase,
): RefObject<ModelState> {
  const state = useRef<ModelState>(modelAt(0, plan));
  // The first frame lands where the page already is, instead of easing in from the top.
  const landed = useRef(false);
  // maath keeps each eased value's velocity on its object: the lens and the sweep need one that lasts.
  const reveal = useRef({ lens: 0, sweep: 0, enter: 0, seal: 0 });
  // The tour's camera, flat for the ease, from where it first enters.
  const pose = useRef<Record<string, number> | null>(null);
  const invalidate = useThree(({ invalidate }) => invalidate);

  useFrame((_, delta) => {
    const target = modelAt(progress.current, plan, { still });
    const current = state.current;
    const dt = Math.min(delta, 0.05);
    const snap = still || !landed.current;
    landed.current = true;
    const ease = (from: Record<string, number>, to: Record<string, number>) => {
      let moving = false;
      for (const key of Object.keys(to)) {
        if (snap) from[key] = to[key]!;
        else easing.damp(from, key, to[key]!, EASE, dt);
        if (Math.abs(from[key]! - to[key]!) > SETTLED) moving = true;
        else from[key] = to[key]!;
      }
      return moving;
    };
    let moving = ease(current.camera, target.camera);
    const { enter, seal } = target.tour;
    if (ease(reveal.current, { lens: target.lens, sweep: target.sweep, enter, seal })) {
      moving = true;
    }
    const aim = target.tour.pose;
    if (aim) {
      const { position: p, target: t } = aim;
      const flat = { px: p.x, py: p.y, pz: p.z, tx: t.x, ty: t.y, tz: t.z, fov: aim.fov };
      // The first pose is taken as it is: the ease into it is `enter`'s.
      if (!pose.current) pose.current = flat;
      else if (ease(pose.current, flat)) moving = true;
    }
    const eased = pose.current;
    current.lens = reveal.current.lens;
    current.sweep = reveal.current.sweep;
    current.phase = target.phase;
    current.tour = {
      enter: reveal.current.enter,
      seal: reveal.current.seal,
      stop: target.tour.stop,
      pose: eased && {
        position: { x: eased.px!, y: eased.py!, z: eased.pz! },
        target: { x: eased.tx!, y: eased.ty!, z: eased.tz! },
        fov: eased.fov!,
      },
    };
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

/** The soft edge of the sweep's band, in metres along the cut. */
const BAND = 3;

/** Where the drawing runs along the cut, in metres: the stretch the sweep crosses. */
type Span = { from: number; to: number };

/**
 * Where the band's leading edge is along the cut, in metres, as the sweep goes from 0 to 1: from
 * just before the drawing, so nothing has turned yet, to just past it, so all of it has. At either
 * end it is out of reach, for whatever stands beyond the drawing.
 */
function sweepFront(sweep: number, { from, to }: Span) {
  if (sweep <= 0) return -1e4;
  if (sweep >= 1) return 1e4;
  return from - BAND + (to - from + BAND * 2) * sweep;
}

/** How far the band has crossed a point along the cut, 0–1, as the shaders have it. */
function sweptAt(front: number, along: number) {
  const t = Math.min(Math.max((along - (front - BAND)) / BAND, 0), 1);
  return 1 - t * t * (3 - 2 * t);
}

/** The sky's share, as the sweep crosses: the paper gives way to it gently, from the start. */
const skyAt = (sweep: number) => Math.min(sweep * 1.4, 1);

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

/** How see-through the glass is once swept. */
const GLASS_OPACITY = 0.32;
const materialIds = Object.keys(MATERIALS) as MaterialId[];

/** The scene's own materials, on the sweep's uniforms they share, made once for the cut. */
function useSweepMaterials(plane: SectionPlane) {
  const made = useMemo(() => {
    const clipping = [clippingPlane(plane)];
    const uniforms = sweepUniforms();
    uniforms.uBand.value = BAND;
    if (plane.runs === "east-west") uniforms.uAxis.value.set(1, 0, 0);
    const materials = Object.fromEntries(
      materialIds.map((id) => [id, sweepMaterial(id, uniforms, clipping)]),
    ) as Record<MaterialId, SweepMaterial>;
    return { materials, lines: sweepLines(uniforms, clipping) };
  }, [plane]);
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
  for (const child of group?.children ?? []) {
    if (child instanceof THREE.LineSegments) lines = child.material as THREE.LineBasicMaterial;
    else if (child instanceof THREE.Mesh) {
      materials.set(child.name as MaterialId, child.material as SweepMaterial);
    }
  }
  const sweep = materials.values().next().value?.userData.sweep;
  return { materials, lines, sweep };
}

/**
 * The house behind the cut: paper lined with ink rising from the drawing as the lens opens, then
 * turned into its materials as the sweep crosses it.
 */
function HouseBehind({
  plan,
  section,
  span,
  palette,
  state,
}: {
  plan: HousePlan;
  section: HouseSection;
  span: Span;
  palette: ModelPalette;
  state: RefObject<ModelState>;
}) {
  const group = useRef<THREE.Group>(null);
  const geometry = useMemo(() => houseGeometry(plan), [plan]);
  const { materials, lines } = useSweepMaterials(section.plane);
  const invalidate = useThree(({ invalidate }) => invalidate);
  const gl = useThree(({ gl }) => gl);
  const scene = useThree(({ scene }) => scene);
  const camera = useThree(({ camera }) => camera);
  useEffect(
    () => () => {
      for (const part of [...Object.values(geometry.faces), geometry.edges]) part?.dispose();
    },
    [geometry],
  );

  // The materials' programs and the shadows', built while the drawing is still on screen, for the
  // lens and the sweep not to stall on them: as the lens fades them, and opaque, under this
  // theme's lights; then one frame of the whole house, out of sight, for the shadows' own.
  useEffect(() => {
    let cancelled = false;
    const house = group.current;
    const { materials } = partsOf(house);
    const each = (transparent: boolean) => {
      for (const [id, material] of materials) {
        if (id === "glass") continue;
        material.transparent = transparent;
        material.needsUpdate = true;
      }
    };
    void (async () => {
      each(true);
      await gl.compileAsync(scene, camera);
      if (cancelled) return;
      each(false);
      await gl.compileAsync(scene, camera);
      if (cancelled || !house) return;
      house.visible = true;
      for (const material of materials.values()) material.visible = true;
      const target = new THREE.WebGLRenderTarget(1, 1);
      gl.setRenderTarget(target);
      gl.render(scene, camera);
      gl.setRenderTarget(null);
      target.dispose();
      // The next frame puts the house back as the choreography has it.
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

  // Where the cut stands, and how far it moves to close behind the tour's camera: past the plot.
  const cutAt = useMemo(() => clippingPlane(section.plane).constant, [section.plane]);
  const { plot } = plan;
  const reach =
    (section.plane.runs === "north-south"
      ? section.plane.at - plot.x
      : plot.z + plot.d - section.plane.at) + 1;

  useFrame(() => {
    const { lens, sweep: swept, tour } = state.current;
    const { materials, lines, sweep } = partsOf(group.current);
    // The plane is shared by every material: moved once, it moves for all of them.
    const plane = materials.values().next().value?.clippingPlanes?.[0];
    if (plane) plane.constant = cutAt + reach * tour.seal;
    if (group.current) group.current.visible = lens > VISIBLE;
    if (sweep) sweep.uFront.value = sweepFront(swept, span);
    // The paper first, opaque early so it hides what is behind it, then the lines on it.
    const paper = Math.min(lens * 4, 1);
    for (const [id, material] of materials) {
      fade(material, paper, id === "glass" ? GLASS_OPACITY : 1);
    }
    fade(lines, lens, EDGE_OPACITY);
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
    </group>
  );
}

/** Rooms whose lights are on at dusk: where the house is lived in, not where it is passed through. */
const LIT_ROOMS = new Set(["living", "dining", "kitchen", "bedroom", "hall"]);

/** A light over each lived-in room, at its floor's level, just under its ceiling. */
function roomLights(plan: HousePlan) {
  const built = plan.floors.filter(({ kind }) => kind !== "plot");
  return built.flatMap((floor, level) =>
    floor.rooms
      .filter((room) => LIT_ROOMS.has(room.kind) && !room.open)
      .map((room) => ({
        id: `${floor.id}-${room.id}`,
        position: new THREE.Vector3(
          room.x + room.w / 2,
          level * STOREY_HEIGHT + 2.2,
          room.z + room.d / 2,
        ),
      })),
  );
}

const along = ({ runs }: SectionPlane, point: THREE.Vector3) =>
  runs === "north-south" ? point.z : point.x;

/**
 * The theme's light on the materials: the sun with its soft shadows and the sky's fill; at dusk,
 * the house's lights and the pool's, each coming on as the sweep reaches it. The paper is lit by
 * the shaders on their own, so none of this changes the drawing.
 */
function SceneLights({
  plan,
  section,
  span,
  palette,
  mobile,
  state,
}: {
  plan: HousePlan;
  section: HouseSection;
  span: Span;
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
  const pool = useRef<THREE.PointLight>(null);

  useEffect(() => {
    const light = sun.current;
    if (!light) return;
    light.target.position.copy(centre);
    light.target.updateMatrixWorld();
  });

  useFrame(() => {
    const front = sweepFront(state.current.sweep, span);
    rooms.forEach(({ position }, i) => {
      const light = roomRefs.current[i];
      if (light && scene.rooms) {
        light.intensity = scene.rooms.intensity * sweptAt(front, along(section.plane, position));
      }
    });
    if (pool.current && scene.pool && poolAt) {
      pool.current.intensity = scene.pool.intensity * sweptAt(front, along(section.plane, poolAt));
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

/** How much of the sky shows on the dome, 0–1: the paper's share is the rest. */
function showSky(
  dome: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial> | null,
  share: number,
) {
  const uniform = dome?.material.uniforms.uSky;
  if (uniform) uniform.value = share;
}

/** The dome the sweep opens onto: the paper at rest, the theme's sky once swept. */
function Sky({ palette, state }: { palette: ModelPalette; state: RefObject<ModelState> }) {
  const material = useMemo(() => skyMaterial(), []);
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
  useFrame(() => showSky(dome.current, skyAt(state.current.sweep)));
  return (
    <mesh ref={dome} material={material} renderOrder={-1} frustumCulled={false}>
      <sphereGeometry args={[300, 32, 16]} />
    </mesh>
  );
}

/** What the scene moves on the occlusion pass (n8ao has no types of its own). */
type OcclusionPass = { enabled: boolean; configuration: { intensity: number } };

/** Ambient occlusion, on desktop only, in the corners of the materials as the sweep reaches them. */
function Occlusion({ palette, state }: { palette: ModelPalette; state: RefObject<ModelState> }) {
  const pass = useRef<OcclusionPass>(null);
  useFrame(() => {
    const ao = pass.current;
    if (!ao) return;
    const { sweep } = state.current;
    // Off until the sweep starts: the drawing and the lens pay nothing for it.
    ao.enabled = sweep > VISIBLE;
    ao.configuration.intensity = palette.scene.occlusion * skyAt(sweep);
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

/**
 * How the sweep wipes the corte's sheet, in step with the house's materials: gone where the band
 * has crossed, soft over its edge, as shares of the drawing's width from its left end.
 */
function sheetWipe(sweep: number, span: Span): SheetWipe {
  if (sweep <= 0) return null;
  const front = sweepFront(sweep, span);
  const width = span.to - span.from;
  return { gone: (front - BAND - span.from) / width, kept: (front - span.from) / width };
}

/** The corte's field of view, narrow so the drawing reads flat; the tour's opens it wider. */
const CORTE_FOV = 30;
/** How much taller the tour's field is on a screen held upright. */
const PORTRAIT_FOV = 1.25;
/** The near plane inside the house, where a wall can stand a step away. */
const TOUR_NEAR = 0.05;

/** A matrix as CSS takes it, with each element's sign as `signs` asks. */
const cssMatrix = ({ elements }: THREE.Matrix4, signs: readonly number[]) =>
  `matrix3d(${elements.map((value, i) => (Math.abs(value) < 1e-10 ? 0 : value * signs[i]!)).join(",")})`;
/** CSS's y runs down: the camera's view, and the object's own axes, flip it as CSS3DRenderer does. */
const CAMERA_SIGNS = [1, -1, 1, 1, 1, -1, 1, 1, 1, -1, 1, 1, 1, -1, 1, 1];
const OBJECT_SIGNS = [1, 1, 1, 1, -1, -1, -1, -1, 1, 1, 1, 1, 1, 1, 1, 1];

/**
 * The camera the choreography asks for. Square on, it stands where the drawing on its plane fits
 * the drawing area as the poster fits it; from there it turns about a point behind the cut. The
 * sheet follows it in CSS 3D.
 */
function CameraRig({
  section,
  frame,
  span,
  area,
  sheet,
  state,
}: {
  section: HouseSection;
  frame: SectionFrameId;
  span: Span;
  area: RefObject<DrawingArea | null>;
  sheet: RefObject<PlaceSheet | null>;
  state: RefObject<ModelState>;
}) {
  const box = sectionViewBox(section, sectionFrame(section, frame));
  // Where the sheet stands: its middle on the cut, facing the camera, a CSS px a metre over 100.
  const placement = useMemo(() => {
    const { plane } = section;
    const centre = toWorld(plane, 0, box.x + box.width / 2, -(box.y + box.height / 2));
    const turn = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      plane.runs === "north-south" ? -Math.PI / 2 : 0,
    );
    return new THREE.Matrix4().compose(
      centre,
      turn,
      new THREE.Vector3().setScalar(1 / SHEET_PX_PER_METRE),
    );
  }, [section, box.x, box.y, box.width, box.height]);

  // Scratch vectors for the tour's pose, made once.
  const own = useMemo(() => ({ position: new THREE.Vector3(), target: new THREE.Vector3() }), []);

  useFrame(({ camera, size }) => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;
    const rect = area.current ?? { left: 0, top: 0, width: size.width, height: size.height };
    if (rect.width <= 0 || rect.height <= 0) return;
    // Metres per CSS px on the plane, as the poster's SVG scales to fit its box, centred in it.
    const scale = Math.max(box.width / rect.width, box.height / rect.height);
    const square = (scale * size.height) / (2 * Math.tan(THREE.MathUtils.degToRad(CORTE_FOV) / 2));
    // The drawing's middle sits at the area's, wherever the area is on the canvas.
    const shiftU = (rect.left + rect.width / 2 - size.width / 2) * scale;
    const shiftY = -(rect.top + rect.height / 2 - size.height / 2) * scale;
    const { yaw, pitch, distance, depth } = state.current.camera;
    const pivot = {
      n: -depth,
      u: box.x + box.width / 2 - shiftU,
      y: -(box.y + box.height / 2) - shiftY,
    };
    const r = distance * square + depth;
    const { plane } = section;
    const position = toWorld(
      plane,
      pivot.n + r * Math.cos(pitch) * Math.cos(yaw),
      pivot.u + r * Math.cos(pitch) * Math.sin(yaw),
      pivot.y + r * Math.sin(pitch),
    );
    const target = toWorld(plane, pivot.n, pivot.u, pivot.y);
    // The tour's camera takes over from the corte's as it enters.
    const { enter, pose } = state.current.tour;
    let fov = CORTE_FOV;
    if (pose && enter > 0) {
      position.lerp(own.position.set(pose.position.x, pose.position.y, pose.position.z), enter);
      target.lerp(own.target.set(pose.target.x, pose.target.y, pose.target.z), enter);
      // A phone held upright needs a taller field to see a room.
      const tourFov = size.width < size.height ? pose.fov * PORTRAIT_FOV : pose.fov;
      fov = THREE.MathUtils.lerp(CORTE_FOV, tourFov, enter);
    }
    // Inside, the walls come close: the near plane with them.
    const near = enter > VISIBLE ? TOUR_NEAR : 1;
    if (camera.fov !== fov || camera.near !== near) {
      camera.fov = fov;
      camera.near = near;
      camera.updateProjectionMatrix();
    }
    camera.position.copy(position);
    camera.lookAt(target);
    camera.updateMatrixWorld();

    const focal = camera.projectionMatrix.elements[5]! * (size.height / 2);
    sheet.current?.({
      perspective: focal,
      width: size.width,
      height: size.height,
      view: `translateZ(${focal}px) ${cssMatrix(camera.matrixWorldInverse, CAMERA_SIGNS)} translate(${size.width / 2}px,${size.height / 2}px)`,
      drawing: `translate(-50%,-50%) ${cssMatrix(placement, OBJECT_SIGNS)}`,
      wipe: sheetWipe(state.current.sweep, span),
    });
  });
  return null;
}

function House({
  plan,
  section,
  frame,
  area,
  sheet,
  progress,
  palette,
  still,
  phase,
  mobile,
}: Omit<HouseModelSceneProps, "onReady">) {
  const state = useChoreography(plan, progress, still, phase);
  const box = sectionViewBox(section, sectionFrame(section, frame));
  const span = { from: box.x, to: box.x + box.width };
  return (
    <>
      <Sky palette={palette} state={state} />
      <SceneLights
        plan={plan}
        section={section}
        span={span}
        palette={palette}
        mobile={mobile}
        state={state}
      />
      <HouseBehind plan={plan} section={section} span={span} palette={palette} state={state} />
      <CameraRig
        section={section}
        frame={frame}
        span={span}
        area={area}
        sheet={sheet}
        state={state}
      />
      {!mobile && <Occlusion palette={palette} state={state} />}
    </>
  );
}

export type HouseModelSceneProps = {
  plan: HousePlan;
  section: HouseSection;
  /** The corte's frame for this screen: the poster's. */
  frame: SectionFrameId;
  /** Where the poster draws the corte, for the camera to frame it there. */
  area: RefObject<DrawingArea | null>;
  /** Places the corte's sheet over the canvas (`SectionSheet`) with the camera. */
  sheet: RefObject<PlaceSheet | null>;
  /** Scroll progress through the pinned stretch, 0–1, kept up to date by the section. */
  progress: RefObject<number>;
  palette: ModelPalette;
  /** Reduced motion: no easing, every state lands at once. */
  still: boolean;
  /** The phase on screen, which reduced motion only changes once the scene has faded out. */
  phase: ModelPhase;
  /** A phone: a lower resolution, cheaper shadows and no ambient occlusion. */
  mobile: boolean;
  /** Once the scene has drawn, for the poster to go. */
  onReady: () => void;
};

/** The canvas. Loaded on its own, without SSR. */
export default function HouseModelScene({ onReady, ...props }: HouseModelSceneProps) {
  const { palette, mobile } = props;
  return (
    <Canvas
      frameloop="demand"
      // No tone mapping: the paper and the ink are the brand's colours, as the SVG draws them.
      flat
      dpr={mobile ? [1, 1.5] : [1, 2]}
      shadows={{ type: THREE.PCFShadowMap }}
      gl={{ antialias: true }}
      camera={{ fov: CORTE_FOV, near: 1, far: 700 }}
      // The sheet lands on the frame after the first.
      onCreated={({ gl }) => {
        // The house is cut by the corte's plane.
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
