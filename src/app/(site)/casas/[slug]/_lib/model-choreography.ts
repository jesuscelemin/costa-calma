import { houseBounds } from "@/features/houses/plan";
import type { HousePlan } from "@/features/houses/schema";

import { tourStops, type Stop, type Vec3 } from "./tour";

// The house model's choreography (ADR 0009): what the pinned scene shows at a point of its scroll.
// Pure, like the flight's timeline: the scene only eases towards it. The corte's lens opens, then
// the sweep turns its ink on paper into materials and light, and the tour walks into the house
// through the cut, holding at each of its stops.

/** The stretch's phases, in order, with the share of the scroll each one ends at. */
export const modelPhases = [
  /** The corte in ink on paper, seen square on: the SVG drawing, line for line. */
  { id: "drawing", end: 0.07 },
  /** The lens opens: the camera turns off the cut and the house behind it gains depth. */
  { id: "lens", end: 0.16 },
  /** The sweep: a band crosses the corte and turns the ink on paper into materials and light. */
  { id: "sweep", end: 0.26 },
  /** The tour: the camera enters through the cut and walks the house, stop by stop. */
  { id: "tour", end: 1 },
] as const;

export type ModelPhase = (typeof modelPhases)[number]["id"];

/**
 * The camera, from the corte seen square on, as its drawing shows it: north on the left on a
 * north–south cut, so the camera stands to the west and looks east into the house; west on the
 * left on an east–west one, from the south looking north.
 */
export type ModelCamera = {
  /** Radians turned off the cut's normal, about the vertical: positive towards its right end. */
  yaw: number;
  /** Radians raised over the horizontal: positive looks down. */
  pitch: number;
  /** As a share of the distance that frames the drawing. */
  distance: number;
  /** Metres behind the cut of the point it turns about: on the cut on the drawing. */
  depth: number;
};

/** A camera in the world: where it stands, what it looks at, and its vertical field, in degrees. */
export type CameraPose = { position: Vec3; target: Vec3; fov: number };

export type TourState = {
  /** How far the camera has left the corte's for the tour's pose, 0–1. */
  enter: number;
  /** How far the cut has closed behind it, 0–1: whole, the house has its walls back. */
  seal: number;
  /** The tour's camera, once it has one. */
  pose: CameraPose | null;
  /** The stop on screen, by its index, whose cartela shows; none before the first. */
  stop: number | null;
};

export type ModelState = {
  phase: ModelPhase;
  /** How far the lens has opened, 0–1. */
  lens: number;
  /** How far the sweep has crossed the corte, 0–1: every material reads it. */
  sweep: number;
  /** The camera about the corte, which the tour's leaves as it enters. */
  camera: ModelCamera;
  tour: TourState;
};

/** Where a phase starts and ends, as shares of the scroll. */
export const phaseBounds = (id: ModelPhase) => {
  const index = modelPhases.findIndex((phase) => phase.id === id);
  return { start: modelPhases[index - 1]?.end ?? 0, end: modelPhases[index]!.end };
};

const LENS = phaseBounds("lens");
/** The lens holds open for a moment before the sweep starts. */
const LENS_OPEN = LENS.start + (LENS.end - LENS.start) * 0.85;
const SWEEP = phaseBounds("sweep");
/** The house holds in colour for the last stretch of the scroll. */
const SWEPT = SWEEP.start + (SWEEP.end - SWEEP.start) * 0.8;

/** Where the camera ends up with the lens open: turned towards the sea, a little from above. */
const OPEN_YAW = 0.55;
const OPEN_PITCH = 0.32;
const OPEN_DISTANCE = 1.35;

const clamp = (value: number) => Math.min(Math.max(value, 0), 1);
/** Eased 0–1 between two points of the scroll: slow in and out, never past either end. */
const between = (progress: number, start: number, end: number) => {
  const t = clamp((progress - start) / (end - start));
  return t * t * (3 - 2 * t);
};
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** How deep the house runs behind its cut, away from the camera, in metres. */
function behindCut(plan: HousePlan) {
  const { section } = plan;
  if (!section) return 0;
  const { x, z, w } = houseBounds(plan);
  return section.runs === "north-south" ? x + w - section.at : section.at - z;
}

/** The phase a point of the scroll is in. */
export function phaseAt(progress: number): ModelPhase {
  return (modelPhases.find(({ end }) => progress < end) ?? modelPhases[modelPhases.length - 1]!).id;
}

/** The tour's field of view inside the house: wider than the corte's, as a room asks. */
export const TOUR_FOV = 60;
/** How far ahead of the camera its target stands. */
const REACH = 4;

/** Shares of the tour's scroll: the way in, each stop's hold, and each way between two stops. */
const ENTRY = 2;
const HOLD = 1;
const TRAVEL = 1.5;
const TOUR = phaseBounds("tour");

/** The tour's stretch, unit by unit: where stop `i` holds, from `holdAt(i)` for `HOLD`. */
const tourLength = (count: number) => ENTRY + count * HOLD + (count - 1) * TRAVEL;
const holdAt = (i: number) => ENTRY + i * (HOLD + TRAVEL);

type Moment =
  | { kind: "entry"; t: number }
  | { kind: "hold"; stop: number }
  | { kind: "travel"; stop: number; t: number };

/** Where the tour is at a share of its own scroll: on the way in, holding, or between two stops. */
function momentAt(share: number, count: number): Moment {
  const units = clamp(share) * tourLength(count);
  if (units < ENTRY) return { kind: "entry", t: units / ENTRY };
  const i = Math.min(Math.floor((units - ENTRY) / (HOLD + TRAVEL)), count - 1);
  const into = units - holdAt(i);
  if (into <= HOLD || i === count - 1) return { kind: "hold", stop: i };
  return { kind: "travel", stop: i, t: (into - HOLD) / TRAVEL };
}

const ease = (t: number) => {
  const c = clamp(t);
  return c * c * (3 - 2 * c);
};

/** The point `s` metres along a path. */
function along(path: readonly Vec3[], s: number): Vec3 {
  let left = Math.max(s, 0);
  for (let i = 1; i < path.length; i++) {
    const [a, b] = [path[i - 1]!, path[i]!];
    const step = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    if (left <= step && step > 0) {
      const t = left / step;
      return { x: mix(a.x, b.x, t), y: mix(a.y, b.y, t), z: mix(a.z, b.z, t) };
    }
    left -= step;
  }
  return path.at(-1)!;
}

const pathLength = (path: readonly Vec3[]) =>
  path.reduce(
    (sum, b, i) =>
      i === 0
        ? 0
        : sum + Math.hypot(b.x - path[i - 1]!.x, b.y - path[i - 1]!.y, b.z - path[i - 1]!.z),
    0,
  );

/** A direction as its heading and its pitch, to turn from one to another the short way round. */
type Heading = { yaw: number; pitch: number };
const headingOf = (from: Vec3, to: Vec3): Heading => ({
  yaw: Math.atan2(to.x - from.x, to.z - from.z),
  pitch: Math.atan2(to.y - from.y, Math.hypot(to.x - from.x, to.z - from.z)),
});
function turn(a: Heading, b: Heading, t: number): Heading {
  let delta = b.yaw - a.yaw;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return { yaw: a.yaw + delta * t, pitch: mix(a.pitch, b.pitch, t) };
}

/** The camera at a point, looking along a heading. */
const poseAt = (position: Vec3, { yaw, pitch }: Heading): CameraPose => ({
  position,
  target: {
    x: position.x + Math.sin(yaw) * Math.cos(pitch) * REACH,
    y: position.y + Math.sin(pitch) * REACH,
    z: position.z + Math.cos(yaw) * Math.cos(pitch) * REACH,
  },
  fov: TOUR_FOV,
});

const stopHeading = ({ view }: Stop) => headingOf(view.from, view.to);
const holding = (stop: Stop) => poseAt(stop.view.from, stopHeading(stop));

/** The camera on its way along a stop's path, turning from one heading to the other. */
function onTheWay(stop: Stop, from: Heading, t: number) {
  const e = ease(t);
  return poseAt(along(stop.path, e * pathLength(stop.path)), turn(from, stopHeading(stop), e));
}

const BEFORE: TourState = { enter: 0, seal: 0, pose: null, stop: null };

/** The tour at a share of its own scroll, for these stops. */
function tourAt(share: number, stops: readonly Stop[], still: boolean): TourState {
  if (stops.length === 0) return BEFORE;
  const moment = momentAt(share, stops.length);
  const settled = (stop: number): TourState => ({
    enter: 1,
    seal: 1,
    pose: holding(stops[stop]!),
    stop,
  });
  switch (moment.kind) {
    case "hold":
      return settled(moment.stop);
    case "travel":
      if (still) return settled(moment.t < 0.5 ? moment.stop : moment.stop + 1);
      return {
        enter: 1,
        seal: 1,
        pose: onTheWay(stops[moment.stop + 1]!, stopHeading(stops[moment.stop]!), moment.t),
        stop: moment.t < 0.5 ? moment.stop : moment.stop + 1,
      };
    case "entry": {
      if (still) return settled(0);
      const first = stops[0]!;
      const [a, b = first.view.from] = first.path;
      // In along the way's first stretch, level, and turning to the stop's view as it arrives.
      const heading = { yaw: headingOf(a!, b).yaw, pitch: 0 };
      return {
        // Once the camera is all the way in, the cut closes behind it.
        enter: between(moment.t, 0, 0.45),
        seal: between(moment.t, 0.45, 0.65),
        pose: onTheWay(first, heading, moment.t),
        stop: moment.t < 0.5 ? null : 0,
      };
    }
  }
}

/** The share of the tour's own scroll, from the stretch's. */
const tourShare = (progress: number) => (clamp(progress) - TOUR.start) / (TOUR.end - TOUR.start);

/** The stop on screen at a point of the stretch's scroll, or none before the tour reaches one. */
export function stopAt(progress: number, plan: HousePlan, options: ModelOptions = {}) {
  if (phaseAt(clamp(progress)) !== "tour") return null;
  return tourAt(tourShare(progress), tourStops(plan), options.still ?? false).stop;
}

/** Where in the stretch's scroll a stop holds, in its middle: where its controls take the page. */
export function stopProgress(index: number, plan: HousePlan) {
  const count = tourStops(plan).length;
  const units = holdAt(Math.min(Math.max(index, 0), count - 1)) + HOLD / 2;
  return TOUR.start + ((TOUR.end - TOUR.start) * units) / tourLength(count);
}

export type ModelOptions = {
  /** Reduced motion: each phase is its destination, for the scene to fade to. */
  still?: boolean;
};

/**
 * The scene at a point of its stretch's scroll (0–1), for the plan's corte. Scroll past either end
 * keeps the first or the last state.
 */
export function modelAt(
  progress: number,
  plan: HousePlan,
  { still = false }: ModelOptions = {},
): ModelState {
  const p = clamp(progress);
  const phase = phaseAt(p);
  const lens = still ? (phase === "drawing" ? 0 : 1) : between(p, LENS.start, LENS_OPEN);
  const swept = phase === "sweep" || phase === "tour";
  const sweep = still ? (swept ? 1 : 0) : between(p, SWEEP.start, SWEPT);
  const tour = phase === "tour" ? tourAt(tourShare(p), tourStops(plan), still) : BEFORE;
  return {
    phase,
    lens,
    sweep,
    tour,
    camera: {
      yaw: OPEN_YAW * lens,
      pitch: OPEN_PITCH * lens,
      distance: mix(1, OPEN_DISTANCE, lens),
      depth: (behindCut(plan) / 2) * lens,
    },
  };
}
