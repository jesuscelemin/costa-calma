import { houseBounds } from "@/features/houses/plan";
import type { HousePlan } from "@/features/houses/schema";

// The house model's choreography (ADR 0009): what the pinned scene shows at a point of its scroll.
// Pure, like the flight's timeline: the scene only eases towards it. The corte's lens opens, then
// the sweep turns its ink on paper into materials and light; the tour comes after it.

/** The stretch's phases, in order, with the share of the scroll each one ends at. */
export const modelPhases = [
  /** The corte in ink on paper, seen square on: the SVG drawing, line for line. */
  { id: "drawing", end: 0.25 },
  /** The lens opens: the camera turns off the cut and the house behind it gains depth. */
  { id: "lens", end: 0.55 },
  /** The sweep: a band crosses the corte and turns the ink on paper into materials and light. */
  { id: "sweep", end: 1 },
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

export type ModelState = {
  phase: ModelPhase;
  /** How far the lens has opened, 0–1. */
  lens: number;
  /** How far the sweep has crossed the corte, 0–1: every material reads it. */
  sweep: number;
  camera: ModelCamera;
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
  const sweep = still ? (phase === "sweep" ? 1 : 0) : between(p, SWEEP.start, SWEPT);
  return {
    phase,
    lens,
    sweep,
    camera: {
      yaw: OPEN_YAW * lens,
      pitch: OPEN_PITCH * lens,
      distance: mix(1, OPEN_DISTANCE, lens),
      depth: (behindCut(plan) / 2) * lens,
    },
  };
}
