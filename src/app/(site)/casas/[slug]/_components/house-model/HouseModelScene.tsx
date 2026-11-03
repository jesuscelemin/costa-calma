"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
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

import { SHEET_PX_PER_METRE, type PlaceSheet } from "./SectionSheet";

// The house model (ADR 0009): a Three.js scene that eases every frame towards the choreography's
// state for the scroll. It starts as the corte's own SVG, the sheet over the canvas, set on the
// plane the house is cut by and seen square on, framed exactly as the poster draws it. As the lens
// opens the camera turns off the cut, and the house behind the plane, cut by it, rises from the
// paper in ink. It renders on demand: only while the scroll moves or the ease has not landed, never
// at rest. Three.js objects are only touched through refs, inside frame callbacks and effects, as
// the React Compiler rules ask.

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
  return feet.flatMap(({ x, z }, i) => {
    const height = 3.4 + (i % 3) * 0.5;
    return [
      new THREE.ConeGeometry(1.1, height, 7).translate(x, 1.6 + height / 2, z),
      new THREE.CylinderGeometry(0.12, 0.16, 1.8, 6).translate(x, 0.9, z),
    ];
  });
}

const merged = (parts: THREE.BufferGeometry[]) => {
  if (parts.length === 0) return null;
  const geometry = mergeGeometries(parts);
  for (const part of parts) part.dispose();
  return geometry;
};

/** The house and its plot in boxes, each floor at its level, as the corte stands them. */
function houseGeometry(plan: HousePlan) {
  const built = plan.floors.filter(({ kind }) => kind !== "plot");
  const models = built.map((floor, level) => {
    const model = floorModel(plan, floor, { next: built[level + 1], below: built[level - 1] });
    const lift = (boxes: Box[]) =>
      boxes.map((box) => ({ ...box, y: box.y + level * STOREY_HEIGHT }));
    return {
      paper: lift([
        ...model.slabs,
        ...model.walls,
        ...model.heads,
        ...model.lids,
        ...model.canopies,
        ...model.stair,
        ...model.joinery,
        ...model.decks,
        ...model.planters,
      ]),
      glass: lift(model.glass),
    };
  });
  const paper = models.flatMap((model) => model.paper);
  // Glass is drawn as its outline only: the panes' edges, nothing hidden behind them.
  const glass = merged(boxesGeometry(models.flatMap((model) => model.glass)));
  const plot = plotModel(plan);
  const faces = merged([
    ...boxesGeometry([
      ...paper,
      ...plot.land,
      ...plot.decks,
      ...(plot.pool ? [plot.pool.basin, ...plot.pool.walls] : []),
    ]),
    ...pinesGeometry(plot.pines),
  ]);
  const edges = merged([
    ...(faces ? [new THREE.EdgesGeometry(faces, 25)] : []),
    ...(glass ? [new THREE.EdgesGeometry(glass, 25)] : []),
  ]);
  glass?.dispose();
  return {
    faces,
    edges,
    water: merged(boxesGeometry(plot.pool ? [plot.pool.water] : [])),
  };
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
  // maath keeps each eased value's velocity on its object: the lens needs one that lasts.
  const lens = useRef({ lens: 0 });
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
    if (ease(lens.current, { lens: target.lens })) moving = true;
    current.lens = lens.current.lens;
    current.phase = target.phase;
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

/** The house behind the cut, in paper lined with ink, rising from the drawing as the lens opens. */
function HouseBehind({
  plan,
  plane,
  palette,
  state,
}: {
  plan: HousePlan;
  plane: SectionPlane;
  palette: ModelPalette;
  state: RefObject<ModelState>;
}) {
  const group = useRef<THREE.Group>(null);
  const faces = useRef<THREE.MeshLambertMaterial>(null);
  const water = useRef<THREE.MeshLambertMaterial>(null);
  const edges = useRef<THREE.LineBasicMaterial>(null);
  const geometry = useMemo(() => houseGeometry(plan), [plan]);
  const clipping = useMemo(() => [clippingPlane(plane)], [plane]);
  useEffect(
    () => () => {
      for (const part of Object.values(geometry)) part?.dispose();
    },
    [geometry],
  );

  useFrame(() => {
    const { lens } = state.current;
    if (group.current) group.current.visible = lens > VISIBLE;
    // The paper first, opaque early so it hides what is behind it, then the lines on it.
    const paper = Math.min(lens * 4, 1);
    fade(faces.current, paper);
    fade(water.current, paper);
    fade(edges.current, lens, EDGE_OPACITY);
  });

  return (
    <group ref={group}>
      {geometry.faces && (
        <mesh geometry={geometry.faces}>
          <meshLambertMaterial
            ref={faces}
            color={palette.paper}
            clippingPlanes={clipping}
            // Lines over faces: the faces step back a little, so their own edges never flicker.
            polygonOffset
            polygonOffsetFactor={1}
            polygonOffsetUnits={1}
          />
        </mesh>
      )}
      {geometry.water && (
        <mesh geometry={geometry.water}>
          <meshLambertMaterial ref={water} color={palette.water} clippingPlanes={clipping} />
        </mesh>
      )}
      {geometry.edges && (
        <lineSegments geometry={geometry.edges}>
          <lineBasicMaterial
            ref={edges}
            color={palette.ink}
            clippingPlanes={clipping}
            transparent
            opacity={0}
          />
        </lineSegments>
      )}
    </group>
  );
}

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
  area,
  sheet,
  state,
}: {
  section: HouseSection;
  frame: SectionFrameId;
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

  useFrame(({ camera, size }) => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;
    const rect = area.current ?? { left: 0, top: 0, width: size.width, height: size.height };
    if (rect.width <= 0 || rect.height <= 0) return;
    // Metres per CSS px on the plane, as the poster's SVG scales to fit its box, centred in it.
    const scale = Math.max(box.width / rect.width, box.height / rect.height);
    const square = (scale * size.height) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
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
    camera.position.copy(
      toWorld(
        plane,
        pivot.n + r * Math.cos(pitch) * Math.cos(yaw),
        pivot.u + r * Math.cos(pitch) * Math.sin(yaw),
        pivot.y + r * Math.sin(pitch),
      ),
    );
    camera.lookAt(toWorld(plane, pivot.n, pivot.u, pivot.y));
    camera.updateMatrixWorld();

    const focal = camera.projectionMatrix.elements[5]! * (size.height / 2);
    sheet.current?.({
      perspective: focal,
      width: size.width,
      height: size.height,
      view: `translateZ(${focal}px) ${cssMatrix(camera.matrixWorldInverse, CAMERA_SIGNS)} translate(${size.width / 2}px,${size.height / 2}px)`,
      drawing: `translate(-50%,-50%) ${cssMatrix(placement, OBJECT_SIGNS)}`,
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
}: Omit<HouseModelSceneProps, "onReady">) {
  const state = useChoreography(plan, progress, still, phase);
  return (
    <>
      <HouseBehind plan={plan} plane={section.plane} palette={palette} state={state} />
      <CameraRig section={section} frame={frame} area={area} sheet={sheet} state={state} />
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
  /** Once the scene has drawn, for the poster to go. */
  onReady: () => void;
};

/** The canvas with its lights. Loaded on its own, without SSR. */
export default function HouseModelScene({ onReady, ...props }: HouseModelSceneProps) {
  const { palette } = props;
  return (
    <Canvas
      frameloop="demand"
      // No tone mapping: the paper and the ink are the brand's colours, as the SVG draws them.
      flat
      dpr={[1, 2]}
      gl={{ antialias: true }}
      camera={{ fov: 30, near: 1, far: 400 }}
      // The sheet lands on the frame after the first.
      onCreated={({ gl }) => {
        // The house is cut by the corte's plane.
        gl.localClippingEnabled = true;
        requestAnimationFrame(() => requestAnimationFrame(onReady));
      }}
      aria-hidden
    >
      <color attach="background" args={[palette.background]} />
      <ambientLight intensity={palette.intensity.ambient} />
      <directionalLight position={[-20, 30, 12]} intensity={palette.intensity.sun} />
      <House {...props} />
    </Canvas>
  );
}
