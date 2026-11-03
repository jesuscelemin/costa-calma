import { houseBounds } from "@/features/houses/plan";
import type { HousePlan } from "@/features/houses/schema";

import { STOREY_HEIGHT } from "./model-geometry";
import {
  cameraRoomAt,
  revealRooms,
  sweepAxis,
  type RevealRoom,
  type SweepAxis,
} from "./room-reveal";
import { EYE_HEIGHT, entranceOf, tourStops, type Vec3 } from "./tour";

// The house model's choreography (ADR 0010): what the pinned scene shows at a point of its scroll.
// Pure, like the flight's timeline: the scene only eases towards it.
//
// One perspective camera does the whole stretch. On the sheet it hangs far above the ground floor
// with a lens of 2°, which flattens perspective until the model, cut at +1,20 m, reads as a plan in
// ink. In the lift the cut rises and the walls grow out of the drawing as the camera tips back; in
// the descent the lens opens and the distance shrinks together, so the frame never jumps, the upper
// floors rise, and the camera lands at eye height in front of the front door. Then it walks: in
// through the door, which swings open, and stop by stop through the house. It only ever turns
// standing still, walks in straight lines through the openings, at a steady pace, and each room
// turns from ink into colour as the camera crosses into it.
//
// The whole stretch is measured in units: a metre walked is one, a quarter turn is `TURN` and so
// on, so the page's scroll gives every metre the same length.

/** The stretch's phases, in order. */
export const modelPhases = [
  /** The ground floor from straight above, as a plan in ink. */
  { id: "sheet" },
  /** The cut rises and the walls grow; the camera tips back. */
  { id: "lift" },
  /** The lens opens, the camera comes down and lands in front of the door. */
  { id: "descent" },
  /** On foot: in through the door and from stop to stop. */
  { id: "tour" },
] as const;

/** How long the phases from above last, in units; the tour's length is its walk's. */
const AERIAL_UNITS = { sheet: 2, lift: 8, descent: 7 };

export type ModelPhase = (typeof modelPhases)[number]["id"];

/** A camera in the world: where it stands, what it looks at, and its vertical field, in degrees. */
export type CameraPose = { position: Vec3; target: Vec3; fov: number };

/** What the screen frames the sheet in: its shape, and where on it the plan goes, as shares of it. */
export type ModelScreen = {
  /** Width over height. */
  aspect: number;
  area: { x: number; y: number; width: number; height: number };
};

/** One room's sweep: how far it has gone (0–1) and the axis it runs along. */
export type RoomReveal = { reveal: number; axis: SweepAxis };

export type ModelState = {
  phase: ModelPhase;
  camera: CameraPose;
  /** How high the house is cut, in metres over the ground floor: past the roof, not at all. */
  cut: number;
  /** How far the front door has swung open, 0–1. */
  door: number;
  /** Each room's sweep, in `revealRooms`' order. */
  rooms: RoomReveal[];
  /** The stop whose cartela shows; none before the first is reached. */
  stop: number | null;
};

/** Where the plan is cut on the sheet, as a plan is drawn: over the windows' sills. */
export const SHEET_CUT = 1.2;
/** Where the lift leaves the cut: just under the ceiling, so the rooms still show from above. */
const LIFT_CUT = 2.75;
/** The cut once the house is whole. */
export const NO_CUT = 1000;

/** The lens on the sheet, and inside the house: wide enough to feel a room, never a fisheye. */
export const SHEET_FOV = 2;
export const WALK_FOV = 50;
/** On a screen held upright the room needs a taller field. */
export const PORTRAIT_WALK_FOV = 70;

/** Units: a quarter turn, the pause at a stop, before setting off, and a room's sweep. */
const TURN = 3;
const HOLD = 4;
const LANDED = 2;
const REVEAL = 2.5;
/** How long a walk takes to get up to pace and to slow down, in units. */
const RAMP = 1.2;
/** Smaller turns than this are not made: a straight line goes on. */
const MIN_TURN = (1.5 * Math.PI) / 180;
/** How much of a stair's slope the camera looks up or down it, and never more than this. */
const STAIR_LOOK = 0.5;
const MAX_PITCH = 0.45;
/** How far ahead of the camera its target stands, on foot. */
const REACH = 4;

const clamp = (value: number, min = 0, max = 1) => Math.min(Math.max(value, min), max);
const smooth = (t: number) => {
  const c = clamp(t);
  return c * c * (3 - 2 * c);
};
const smoother = (t: number) => {
  const c = clamp(t);
  return c * c * c * (c * (c * 6 - 15) + 10);
};
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => ({
  x: mix(a.x, b.x, t),
  y: mix(a.y, b.y, t),
  z: mix(a.z, b.z, t),
});

// ---- On foot ------------------------------------------------------------------------------------

/** Where the camera looks: its heading on the plan, from the south round to the east, and up. */
export type Heading = { yaw: number; pitch: number };

const headingOf = (from: Vec3, to: Vec3, look = 1): Heading => {
  const flat = Math.hypot(to.x - from.x, to.z - from.z);
  return {
    yaw: Math.atan2(to.x - from.x, to.z - from.z),
    pitch: clamp(Math.atan2(to.y - from.y, flat) * look, -MAX_PITCH, MAX_PITCH),
  };
};

const yawDelta = (a: number, b: number) => {
  let delta = b - a;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
};
const turnSize = (a: Heading, b: Heading) =>
  Math.abs(yawDelta(a.yaw, b.yaw)) + Math.abs(b.pitch - a.pitch);
const turnBy = (a: Heading, b: Heading, t: number): Heading => ({
  yaw: a.yaw + yawDelta(a.yaw, b.yaw) * t,
  pitch: mix(a.pitch, b.pitch, t),
});

/** What the camera does for a stretch of units: stands still, turns where it stands, or walks. */
export type Action =
  | { kind: "hold"; units: number; at: Vec3; heading: Heading; stop: number | null }
  | { kind: "turn"; units: number; at: Vec3; from: Heading; to: Heading; stop: number | null }
  | { kind: "walk"; units: number; from: Vec3; to: Vec3; heading: Heading; stop: number | null };

const distance = (a: Vec3, b: Vec3) => Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
const flatDistance = (a: Vec3, b: Vec3) => Math.hypot(b.x - a.x, b.z - a.z);

/**
 * The share of a walk covered at a share of its time: up to pace over its first `RAMP` units,
 * steady, and slowing over its last, never stopping dead in between nor going past its end.
 */
function walked(t: number, units: number) {
  const k = Math.min(0.5, RAMP / Math.max(units, 1e-6));
  const top = 1 / (1 - k);
  const c = clamp(t);
  if (c < k) return (top * c * c) / (2 * k);
  if (c > 1 - k) return 1 - (top * (1 - c) * (1 - c)) / (2 * k);
  return top * (k / 2 + (c - k));
}

/** The way the camera's heading looks along a stretch of a walk: level, but up or down a stair. */
function walkHeading(from: Vec3, to: Vec3, before: Heading): Heading {
  if (flatDistance(from, to) < 0.05) return { yaw: before.yaw, pitch: 0 };
  return headingOf(from, to, STAIR_LOOK);
}

/**
 * The camera on foot, action by action, from where the descent lands: it waits a moment, then for
 * each stop turns to each stretch of its way before walking it, and turns to the stop's view,
 * where it holds. Stretches on a straight line are one walk.
 */
export function walkActions(plan: HousePlan): Action[] {
  const stops = tourStops(plan);
  const entrance = entranceOf(plan);
  const first = stops[0];
  if (!first) return [];
  const start = entrance?.landing ?? first.view.from;
  let at = start;
  let heading: Heading = entrance
    ? { yaw: Math.atan2(entrance.inward.x, entrance.inward.z), pitch: 0 }
    : headingOf(first.view.from, first.view.to);
  const actions: Action[] = [{ kind: "hold", units: LANDED, at, heading, stop: null }];
  const turnTo = (to: Heading, stop: number | null) => {
    const size = turnSize(heading, to);
    if (size >= MIN_TURN) {
      actions.push({
        kind: "turn",
        units: Math.max((size / (Math.PI / 2)) * TURN, 0.8),
        at,
        from: heading,
        to,
        stop,
      });
    }
    heading = to;
    return size >= MIN_TURN;
  };
  stops.forEach((stop, index) => {
    // On the way here the cartela still shows the stop before.
    const showing = index === 0 ? null : index - 1;
    for (const point of stop.path) {
      if (distance(at, point) < 0.01) continue;
      const turned = turnTo(walkHeading(at, point, heading), showing);
      const last = actions.at(-1);
      if (!turned && last?.kind === "walk") {
        last.to = point;
        last.units = distance(last.from, point);
      } else {
        actions.push({
          kind: "walk",
          units: distance(at, point),
          from: at,
          to: point,
          heading,
          stop: showing,
        });
      }
      at = point;
    }
    // Arrived: the cartela changes, and the camera turns to the stop's view and holds.
    turnTo(headingOf(stop.view.from, stop.view.to), index);
    actions.push({ kind: "hold", units: HOLD, at, heading, stop: index });
  });
  return actions;
}

/** Where the camera is and looks at a point of an action, `t` of the way through it. */
function poseOf(action: Action, t: number): { position: Vec3; heading: Heading } {
  switch (action.kind) {
    case "hold":
      return { position: action.at, heading: action.heading };
    case "turn":
      return { position: action.at, heading: turnBy(action.from, action.to, smooth(t)) };
    case "walk":
      return {
        position: lerp3(action.from, action.to, walked(t, action.units)),
        heading: action.heading,
      };
  }
}

const lookAlong = (position: Vec3, { yaw, pitch }: Heading): Vec3 => ({
  x: position.x + Math.sin(yaw) * Math.cos(pitch) * REACH,
  y: position.y + Math.sin(pitch) * REACH,
  z: position.z + Math.cos(yaw) * Math.cos(pitch) * REACH,
});

// ---- The timeline -------------------------------------------------------------------------------

type Timeline = {
  /** Where each phase starts, in units, and the whole stretch's length. */
  starts: Record<ModelPhase, number>;
  total: number;
  actions: Action[];
  /** Where each action starts, in units from the tour's start. */
  at: number[];
  rooms: RevealRoom[];
  /** When the camera first crosses into each room, in units from the stretch's start, and which way. */
  entries: ({ units: number; axis: SweepAxis } | null)[];
  /** When it first stands inside the house. */
  inside: number;
};

/** How finely the camera's way is sampled to find when it crosses into each room, in units. */
const SAMPLE = 0.05;

const timelines = new WeakMap<HousePlan, Timeline>();

function timelineOf(plan: HousePlan): Timeline {
  const known = timelines.get(plan);
  if (known) return known;
  const actions = walkActions(plan);
  const at: number[] = [];
  let walking = 0;
  for (const action of actions) {
    at.push(walking);
    walking += action.units;
  }
  const { sheet, lift, descent } = AERIAL_UNITS;
  const starts = { sheet: 0, lift: sheet, descent: sheet + lift, tour: sheet + lift + descent };
  const total = starts.tour + walking;

  // Along the way on foot: the rooms the camera crosses into, once it is inside the house.
  const rooms = revealRooms(plan);
  const entries: Timeline["entries"] = rooms.map(() => null);
  const storeys = new Set(plan.floors.filter(({ kind }) => kind !== "plot"));
  let inside = Number.POSITIVE_INFINITY;
  let previous: Vec3 | null = null;
  actions.forEach((action, i) => {
    const steps = Math.max(1, Math.ceil(action.units / SAMPLE));
    for (let s = 0; s <= steps; s++) {
      const { position } = poseOf(action, s / steps);
      const units = starts.tour + at[i]! + (action.units * s) / steps;
      const index = cameraRoomAt(rooms, position);
      if (index >= 0 && storeys.has(rooms[index]!.floor) && units < inside) inside = units;
      if (index >= 0 && units >= inside && !entries[index]) {
        const { yaw } = poseOf(action, s / steps).heading;
        const step = previous
          ? { x: position.x - previous.x, z: position.z - previous.z }
          : { x: Math.sin(yaw), z: Math.cos(yaw) };
        entries[index] = { units, axis: sweepAxis(step) };
      }
      previous = position;
    }
  });
  // A double height turns with the room under it.
  rooms.forEach((room, i) => {
    if (room.under !== undefined) entries[i] = entries[room.under] ?? null;
  });

  const timeline = { starts, total, actions, at, rooms, entries, inside };
  timelines.set(plan, timeline);
  return timeline;
}

/** The stretch's length, in units: the page gives it its height from this. */
export const modelUnits = (plan: HousePlan) => timelineOf(plan).total;

/** Where a phase starts and ends, as shares of the scroll. */
export function phaseBounds(id: ModelPhase, plan: HousePlan) {
  const { starts, total } = timelineOf(plan);
  const index = modelPhases.findIndex((phase) => phase.id === id);
  const next = modelPhases[index + 1];
  return { start: starts[id] / total, end: next ? starts[next.id] / total : 1 };
}

/** The phase a point of the scroll is in. */
export function phaseAt(progress: number, plan: HousePlan): ModelPhase {
  const { starts, total } = timelineOf(plan);
  const units = clamp(progress) * total;
  return [...modelPhases].reverse().find(({ id }) => units >= starts[id])!.id;
}

/** The action under a number of units into the tour, and how far through it. */
function actionAt({ actions, at }: Timeline, units: number) {
  let i = 0;
  while (i < actions.length - 1 && units >= at[i + 1]!) i++;
  const action = actions[i]!;
  return { index: i, action, t: clamp((units - at[i]!) / action.units) };
}

/** Where in the stretch's scroll a stop holds, in its middle: where its controls take the page. */
export function stopProgress(index: number, plan: HousePlan) {
  const timeline = timelineOf(plan);
  const { actions, at, starts, total } = timeline;
  const count = tourStops(plan).length;
  const stop = Math.min(Math.max(index, 0), count - 1);
  const i = actions.findIndex((action) => action.kind === "hold" && action.stop === stop);
  if (i < 0) return 1;
  return (starts.tour + at[i]! + actions[i]!.units / 2) / total;
}

// ---- From above ---------------------------------------------------------------------------------

/** Keys of a track: at a share of its stretch, a value, eased into from the key before. */
type Key = [share: number, value: number, ease?: (t: number) => number];

function track(keys: readonly Key[]) {
  return (s: number) => {
    if (s <= keys[0]![0]) return keys[0]![1];
    for (let i = 1; i < keys.length; i++) {
      const [at, value, ease = (t: number) => t] = keys[i]!;
      if (s <= at) {
        const [before, from] = keys[i - 1]!;
        return mix(from, value, ease((s - before) / (at - before)));
      }
    }
    return keys.at(-1)![1];
  };
}

const rad = Math.PI / 180;
const tanHalf = (degrees: number) => Math.tan((degrees * rad) / 2);

/** The camera in the lift and the descent: tipped early, so the walls are seen rising. */
const early = (t: number) => 0.5 * smooth(t) + 0.5 * (1 - (1 - t) * (1 - t));

/** The lens inside the house, for a screen of this shape. */
export const walkFov = (aspect: number) => (aspect < 0.9 ? PORTRAIT_WALK_FOV : WALK_FOV);

/**
 * The camera from above, from the sheet to where the descent lands, `s` of the way (0–1) from the
 * sheet's start to the descent's end. It hangs over a point, tipped back from straight down by an
 * elevation, with a lens and the height of what it frames, both eased on a log scale so the frame
 * never jumps as one opens and the other shrinks.
 */
function aerial(plan: HousePlan, screen: ModelScreen, s: number, ends: [number, number]) {
  const entrance = entranceOf(plan);
  const inward = entrance?.inward ?? { x: 0, z: 1 };
  const door = entrance?.door ?? { x: 0, y: EYE_HEIGHT, z: 0 };
  // The screen's up is the way in, and its right a quarter turn clockwise from it, looking down.
  const right = { x: -inward.z, z: inward.x };
  // The sheet frames the house with what is built round it, the porch and the pool, and a margin.
  const sheet = sheetBounds(plan);
  const centre = { x: sheet.x + sheet.w / 2, z: sheet.z + sheet.d / 2 };
  const along = Math.abs(inward.z) > 0.5;
  const tall = along ? sheet.d : sheet.w;
  const wide = along ? sheet.w : sheet.d;
  const { aspect, area } = screen;
  // The plot fits the area as an SVG's viewBox fits its box, centred in it.
  const frame0 = Math.max(tall / area.height, wide / (area.width * aspect));
  const shiftRight = (area.x + area.width / 2 - 0.5) * frame0 * aspect;
  const shiftUp = (0.5 - (area.y + area.height / 2)) * frame0;
  const sheetAt = {
    x: centre.x - right.x * shiftRight - inward.x * shiftUp,
    z: centre.z - right.z * shiftRight - inward.z * shiftUp,
  };
  const house = houseBounds(plan);
  const middle = { x: house.x + house.w / 2, z: house.z + house.d / 2 };
  const fov = walkFov(aspect);
  const landFrame = 2 * (entranceDistance(entrance) || 7) * tanHalf(fov);
  const [s1, s2] = ends;
  const L = Math.log;

  const elevation = track([
    [0, 89.9],
    [s1, 89.9],
    [s2, 33, early],
    [1, 0, smooth],
  ])(s);
  const lens = track([
    [0, L(tanHalf(SHEET_FOV))],
    [s1, L(tanHalf(SHEET_FOV))],
    [s2, L(tanHalf(4.6)), smooth],
    [1, L(tanHalf(fov)), smoother],
  ])(s);
  const frame = track([
    [0, L(frame0)],
    [s1, L(frame0)],
    [s2, L(frame0 * 0.78), smooth],
    [1, L(landFrame), smoother],
  ])(s);
  const tx = track([
    [0, sheetAt.x],
    [s1, sheetAt.x],
    [s2, middle.x, smooth],
    [1, door.x, smooth],
  ])(s);
  const ty = track([
    [s1, 0],
    [s2, 1.2, smooth],
    [1, door.y, smooth],
  ])(s);
  const tz = track([
    [0, sheetAt.z],
    [s1, sheetAt.z],
    [s2, middle.z, smooth],
    [1, door.z, smooth],
  ])(s);

  const half = Math.exp(lens);
  const reach = Math.exp(frame) / (2 * half);
  const e = elevation * rad;
  const target = { x: tx, y: ty, z: tz };
  const position = {
    x: tx - inward.x * reach * Math.cos(e),
    y: ty + reach * Math.sin(e),
    z: tz - inward.z * reach * Math.cos(e),
  };
  return { position, target, fov: (2 * Math.atan(half)) / rad };
}

/** What the sheet shows: the house and the plot's built rooms, with a margin, within the plot. */
const SHEET_MARGIN = 2;
function sheetBounds(plan: HousePlan) {
  const rects = [
    houseBounds(plan),
    ...plan.floors
      .filter(({ kind }) => kind === "plot")
      .flatMap(({ rooms }) => rooms.filter(({ kind }) => kind !== "garden")),
  ];
  const x0 = Math.max(plan.plot.x, Math.min(...rects.map(({ x }) => x)) - SHEET_MARGIN);
  const z0 = Math.max(plan.plot.z, Math.min(...rects.map(({ z }) => z)) - SHEET_MARGIN);
  const x1 = Math.min(
    plan.plot.x + plan.plot.w,
    Math.max(...rects.map(({ x, w }) => x + w)) + SHEET_MARGIN,
  );
  const z1 = Math.min(
    plan.plot.z + plan.plot.d,
    Math.max(...rects.map(({ z, d }) => z + d)) + SHEET_MARGIN,
  );
  return { x: x0, z: z0, w: x1 - x0, d: z1 - z0 };
}

const entranceDistance = (entrance: ReturnType<typeof entranceOf>) =>
  entrance ? flatDistance(entrance.landing, entrance.door) : 0;

/** The height the house is cut at from above: the walls rise, then the floors above, then none. */
function cutAt(plan: HousePlan, s: number, [s1, s2]: [number, number]) {
  const storeys = plan.floors.filter(({ kind }) => kind !== "plot").length;
  const top = storeys * STOREY_HEIGHT + 1.5;
  return track([
    [s1 + 0.01, SHEET_CUT],
    [s2, LIFT_CUT, smooth],
    [s2 + (1 - s2) * 0.78, top, smooth],
    [1, NO_CUT, (t) => (t < 1 ? 0 : 1)],
  ])(s);
}

// ---- The state --------------------------------------------------------------------------------

export type ModelOptions = {
  /** Reduced motion: each phase and each stop is its destination, for the scene to fade to. */
  still?: boolean;
  /** The screen the sheet is framed on; a landscape one by default. */
  screen?: ModelScreen;
};

const DEFAULT_SCREEN: ModelScreen = {
  aspect: 16 / 10,
  area: { x: 0.4, y: 0.08, width: 0.56, height: 0.86 },
};

/** How far the front door has swung, from how near the camera is: open by the time it gets there. */
function doorAt(position: Vec3, plan: HousePlan, inside: boolean) {
  const entrance = entranceOf(plan);
  if (!entrance) return 0;
  if (inside) return 1;
  return smooth((6.5 - flatDistance(position, entrance.door)) / 4.4);
}

/** The stop on screen at a number of units into the stretch. */
function stopUnder(timeline: Timeline, units: number) {
  if (units < timeline.starts.tour) return null;
  return actionAt(timeline, units - timeline.starts.tour).action.stop;
}

/** The stop on screen at a point of the stretch's scroll, or none before the tour reaches one. */
export function stopAt(progress: number, plan: HousePlan, options: ModelOptions = {}) {
  return modelAt(progress, plan, options).stop;
}

/** The units a point of the stretch stands for with reduced motion: its phase's or stop's end. */
function stillUnits(timeline: Timeline, units: number) {
  const { starts, actions, at } = timeline;
  if (units < starts.lift) return 0;
  if (units < starts.descent) return starts.descent - 1e-6;
  if (units < starts.tour) return starts.tour;
  // On foot: the stop on screen, settled, from its hold's middle to the next one's.
  const holds = actions
    .map((action, i) => ({ action, i }))
    .filter(({ action }) => action.kind === "hold" && action.stop !== null);
  const middle = ({ action, i }: (typeof holds)[number]) => starts.tour + at[i]! + action.units / 2;
  let pick = holds[0];
  for (const hold of holds) if (units >= middle(hold) - 1e-9) pick = hold;
  if (!pick) return starts.tour;
  // Before the first stop's middle there is only the first stop.
  return middle(pick);
}

/** The scene at a point of its stretch's scroll (0–1). Past either end, the first or the last. */
export function modelAt(
  progress: number,
  plan: HousePlan,
  { still = false, screen = DEFAULT_SCREEN }: ModelOptions = {},
): ModelState {
  const timeline = timelineOf(plan);
  const { starts, total, rooms, entries, inside } = timeline;
  const raw = clamp(progress) * total;
  const units = still ? stillUnits(timeline, raw) : raw;
  const phase = [...modelPhases].reverse().find(({ id }) => units >= starts[id])!.id;

  let camera: CameraPose;
  let cut = NO_CUT;
  if (units < starts.tour || timeline.actions.length === 0) {
    const span = starts.tour;
    const ends: [number, number] = [starts.lift / span, starts.descent / span];
    const s = clamp(units / span);
    camera = aerial(plan, screen, s, ends);
    cut = cutAt(plan, s, ends);
  } else {
    const { action, t } = actionAt(timeline, units - starts.tour);
    const { position, heading } = poseOf(action, t);
    camera = { position, target: lookAlong(position, heading), fov: walkFov(screen.aspect) };
  }

  const reveals = rooms.map((_, i): RoomReveal => {
    const entry = entries[i];
    if (!entry) return { reveal: 0, axis: "+z" };
    const reveal = clamp((units - entry.units) / REVEAL);
    return { reveal: still ? (reveal > 0 ? 1 : 0) : reveal, axis: entry.axis };
  });

  return {
    phase,
    camera,
    cut,
    door: units < starts.tour ? 0 : doorAt(camera.position, plan, units >= inside),
    rooms: reveals,
    stop: stopUnder(timeline, units),
  };
}
