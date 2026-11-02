import type { PlanFloor } from "@/features/houses/schema";

// The house model's choreography (ADR 0006): where each floor and the camera are at a point of the
// pinned stretch's scroll. Pure, like the flight's timeline: the scene only eases towards it.

/** The stretch's phases, in order, with the share of the scroll each one ends at. */
export const modelPhases = [
  /** The empty plot in three-quarter view: the land, the pines, the pool's hollow. */
  { id: "plot", end: 0.14 },
  /** The ground floor drawn in ink on the land, doors and windows included. */
  { id: "plan", end: 0.34 },
  /** The walls rise from those lines, with their openings; the pool fills. */
  { id: "walls", end: 0.54 },
  /** The storeys above and the roof built one on top of the other. */
  { id: "storeys", end: 0.76 },
  /** The floors part in the air with their lights on. */
  { id: "open", end: 1 },
] as const;

export type ModelPhase = (typeof modelPhases)[number]["id"];

export type ModelFloorState = {
  /** Metres above where the floor stands when the house is closed. */
  lift: number;
  /** 0–1. */
  opacity: number;
  /** How much of its plan is drawn in ink, 0–1. */
  plan: number;
  /** Its walls' height, as a share of their full height. */
  walls: number;
  /** From ink lines (0) to built surfaces (1). */
  solid: number;
  /** Its interior lights, 0–1. */
  light: number;
};

/** An orbit around the house: angles in radians, `distance` as a share of the framing distance. */
export type ModelCamera = {
  /** Around the vertical, from the south (the sea); positive towards the east. */
  azimuth: number;
  /** From the vertical: 0 looks straight down. */
  polar: number;
  distance: number;
  /** Height in metres of the point it looks at. */
  targetY: number;
};

export type ModelState = {
  phase: ModelPhase;
  /** One per floor of the plan, in its order. */
  floors: ModelFloorState[];
  /** How full the pool is, 0–1. */
  pool: number;
  camera: ModelCamera;
};

/** Floor-to-floor height, metres. */
export const STOREY_HEIGHT = 3;
/** The gap the open house leaves between one built floor and the next, metres. */
export const OPEN_GAP = 3.4;

const clamp = (value: number) => Math.min(Math.max(value, 0), 1);
/** Eased 0–1 between two points of the scroll: slow in and out, never past either end. */
const between = (progress: number, start: number, end: number) => {
  const t = clamp((progress - start) / (end - start));
  return t * t * (3 - 2 * t);
};
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

const phaseBounds = (id: ModelPhase) => {
  const index = modelPhases.findIndex((phase) => phase.id === id);
  return { start: modelPhases[index - 1]?.end ?? 0, end: modelPhases[index]!.end };
};

const PLAN = phaseBounds("plan");
const WALLS = phaseBounds("walls");
const STOREYS = phaseBounds("storeys");
const OPEN = phaseBounds("open");
/** The open house holds still for the last stretch of its phase. */
const OPEN_END = OPEN.start + (OPEN.end - OPEN.start) * 0.75;

/** The phase a point of the scroll is in. */
export function phaseAt(progress: number): ModelPhase {
  return (modelPhases.find(({ end }) => progress < end) ?? modelPhases[modelPhases.length - 1]!).id;
}

/**
 * The model at a point of its stretch's scroll (0–1): the state of each of the plan's floors, the
 * pool and the camera. Scroll past either end keeps the first or the last state.
 */
export function modelAt(progress: number, floors: readonly Pick<PlanFloor, "kind">[]): ModelState {
  const p = clamp(progress);
  const built = floors.filter(({ kind }) => kind !== "plot");
  const above = Math.max(built.length - 1, 1);
  const open = between(p, OPEN.start, OPEN_END);
  const storeyShare = (STOREYS.end - STOREYS.start) / above;

  const states = floors.map((floor): ModelFloorState => {
    if (floor.kind === "plot") {
      return { lift: 0, opacity: 1, plan: 1, walls: 1, solid: 1, light: 0 };
    }
    const level = built.indexOf(floor);
    const light = between(p, OPEN.start, OPEN_END);
    const lift = level * OPEN_GAP * open;
    if (level === 0) {
      const plan = between(p, PLAN.start, PLAN.end);
      return {
        lift,
        opacity: between(p, PLAN.start, PLAN.start + 0.02),
        plan,
        walls: between(p, WALLS.start, WALLS.end),
        solid: between(p, WALLS.start, WALLS.start + (WALLS.end - WALLS.start) * 0.6),
        light,
      };
    }
    // Each floor above takes its turn: its slab appears, plan already drawn, then its walls rise.
    const start = STOREYS.start + storeyShare * (level - 1);
    const end = start + storeyShare;
    const appear = between(p, start, start + storeyShare * 0.3);
    return {
      lift,
      opacity: appear,
      plan: appear,
      walls: between(p, start + storeyShare * 0.2, end),
      solid: 1,
      light,
    };
  });

  // The camera looks down on the plan to read it, then backs off as the house grows and opens.
  const reading =
    between(p, PLAN.start, PLAN.start + 0.08) * (1 - between(p, WALLS.start, WALLS.end));
  const grown = between(p, STOREYS.start, OPEN_END);
  const height = built.length * STOREY_HEIGHT + (built.length - 1) * OPEN_GAP * open;
  const camera: ModelCamera = {
    azimuth: mix(0.75, 0.55, between(p, 0, OPEN_END)),
    polar: mix(1.0, 0.55, reading) + 0.08 * open,
    distance: mix(1.1, 1.25, grown) + 0.1 * open,
    targetY: mix(0.5, height / 2, grown),
  };

  return {
    phase: phaseAt(p),
    floors: states,
    pool: between(p, WALLS.start, WALLS.end),
    camera,
  };
}
