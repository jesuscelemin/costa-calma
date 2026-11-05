import { houseBounds } from "@/features/houses/plan";
import type { HousePlan, PlanFloor, Rect, Room } from "@/features/houses/schema";

import { STOREY_HEIGHT, WALL_HEIGHT } from "./model-geometry";
import {
  cameraRoomAt,
  revealRooms,
  ROOM_BAND,
  sweepAxis,
  type RevealRoom,
  type SweepAxis,
} from "./room-reveal";
import {
  builtFloors,
  EYE_HEIGHT,
  entranceOf,
  floorLevel,
  tourStops,
  entryViewpoint,
  type Vec3,
} from "./tour";
import { floorAnnotations, planSheet, sheetWorldBounds } from "./plan-sheet";
import {
  phaseOf,
  phaseUnder,
  stopMiddle,
  stopOf,
  stopUnder,
  modelPhases,
  unitsAt,
  type ModelPhase,
  type ScrollMarks,
  type ScrollPhase,
} from "./model-scroll";
import { routeBetween, tourWays } from "./tour-route";

export { modelPhases, type ModelPhase, type ScrollPhase } from "./model-scroll";

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

/** How long the phases from above last, in units; the tour's length is its walk's. */
const AERIAL_UNITS = { sheet: 2, lift: 8, descent: 7 };

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

/**
 * Where a floor of the house stands: how far it is lifted out of the way, in metres, how much of
 * it shows, 0–1, and how much of its plan's axes, dimensions and title are drawn round it, 0–1.
 */
export type FloorPose = { id: string; lift: number; opacity: number; plan: number };

export type ModelState = {
  phase: ModelPhase;
  /** The floor picked from the whole house, if one is. */
  floor: string | null;
  /** The room of the picked floor the camera is in, or going into or out of. */
  room: string | null;
  /** Each of the plan's floors, in its order, Exterior first. */
  floors: FloorPose[];
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
const TURN = 2.2;
const HOLD = 3.5;
const LANDED = 2;
const REVEAL = 1.6;
/** How long a walk takes to get up to pace and to slow down, in units. */
const RAMP = 1.2;
/** Smaller turns than this are not made: a straight line goes on. */
const MIN_TURN = (10 * Math.PI) / 180;
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

/**
 * What the camera does for a stretch of units: stands still, turns where it stands, or walks; and
 * at the end, rises over the house, the one move that turns and moves at once.
 */
export type Action =
  | { kind: "hold"; units: number; at: Vec3; heading: Heading; stop: number | null }
  | { kind: "turn"; units: number; at: Vec3; from: Heading; to: Heading; stop: number | null }
  | { kind: "walk"; units: number; from: Vec3; to: Vec3; heading: Heading; stop: number | null }
  | { kind: "rise"; units: number; from: Vec3; heading: Heading; to: CameraPose; stop: null };

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
  const ways = tourWays(plan);
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
        units: Math.max((size / (Math.PI / 2)) * TURN, 0.6),
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
    for (const point of ways[index] ?? stop.path) {
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
  // Out into the open air beside the last stop, to its far edge; there it turns to face the
  // house and the camera pulls back and up over all of it, seen from above as it started, now
  // built and in colour, without passing through anything.
  const last = stops.at(-1)!;
  const exit = openAirBeside(plan, last);
  if (exit) {
    const way = routeBetween(plan, at, exit) ?? [at, exit];
    const showing = stops.length - 1;
    for (const point of way) {
      if (distance(at, point) < 0.01) continue;
      const turned = turnTo(walkHeading(at, point, heading), showing);
      const previous = actions.at(-1);
      if (!turned && previous?.kind === "walk") {
        previous.to = point;
        previous.units = distance(previous.from, point);
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
    const house = houseBounds(plan);
    const centre = { x: house.x + house.w / 2, y: at.y, z: house.z + house.d / 2 };
    turnTo({ yaw: headingOf(at, centre).yaw, pitch: 0 }, showing);
  }
  const view = overview(plan, heading);
  actions.push({ kind: "rise", units: RISE, from: at, heading, to: view, stop: null });
  actions.push({ kind: "hold", units: HOLD, at: view.position, heading, stop: null });
  return actions;
}

/** How long the rise over the house takes, in units. */
const RISE = 12;
/** The overview's lens, and how high over the horizontal it looks down. */
const OVERVIEW_FOV = 30;
const OVERVIEW_ELEVATION = 58;

/**
 * The house from above at the end: looking down at its middle, from behind where the tour ends,
 * along the way the camera faces: the rise pulls back from there, never through the house.
 */
function overview(plan: HousePlan, { yaw }: Heading): CameraPose {
  const house = houseBounds(plan);
  const target = { x: house.x + house.w / 2, y: 2, z: house.z + house.d / 2 };
  const span = Math.hypot(house.w, house.d) * 1.15;
  const reach = span / (2 * tanHalf(OVERVIEW_FOV));
  const e = OVERVIEW_ELEVATION * rad;
  return {
    target,
    position: {
      x: target.x - Math.sin(yaw) * Math.cos(e) * reach,
      y: target.y + Math.sin(e) * reach,
      z: target.z - Math.cos(yaw) * Math.cos(e) * reach,
    },
    fov: OVERVIEW_FOV,
  };
}

/**
 * The open-air room beside a stop's room on its floor, a terrace or a porch, and a point near
 * its edge farthest from the house: where the tour steps out to rise over it.
 */
function openAirBeside(plan: HousePlan, stop: ReturnType<typeof tourStops>[number]): Vec3 | null {
  const house = houseBounds(plan);
  const centre = { x: house.x + house.w / 2, z: house.z + house.d / 2 };
  const level = stop.view.from.y;
  const rooms = stop.floor.rooms.filter(
    (room) =>
      room.open &&
      room.kind !== "void" &&
      room !== stop.room &&
      (Math.abs(room.x - (stop.room.x + stop.room.w)) < 1e-6 ||
        Math.abs(room.x + room.w - stop.room.x) < 1e-6 ||
        Math.abs(room.z - (stop.room.z + stop.room.d)) < 1e-6 ||
        Math.abs(room.z + room.d - stop.room.z) < 1e-6),
  );
  const room = rooms[0];
  if (!room) return null;
  const middle = { x: room.x + room.w / 2, z: room.z + room.d / 2 };
  const away = { x: middle.x - centre.x, z: middle.z - centre.z };
  const edge = 0.8;
  return Math.abs(away.z) >= Math.abs(away.x)
    ? { x: middle.x, y: level, z: away.z > 0 ? room.z + room.d - edge : room.z + edge }
    : { x: away.x > 0 ? room.x + room.w - edge : room.x + edge, y: level, z: middle.z };
}

/** The overview drawn back on a screen narrower than it is tall, for the house to fit across. */
function fitted(pose: CameraPose, aspect: number): CameraPose {
  const k = 1 / Math.min(1, aspect);
  if (k === 1) return pose;
  const { position: p, target: q } = pose;
  return {
    ...pose,
    position: { x: q.x + (p.x - q.x) * k, y: q.y + (p.y - q.y) * k, z: q.z + (p.z - q.z) * k },
  };
}

/** The camera rising from where the tour ends to the overview, `t` of the way. */
function rising(action: Extract<Action, { kind: "rise" }>, t: number, fov: number): CameraPose {
  const e = smoother(t);
  const start = { position: action.from, target: lookAlong(action.from, action.heading) };
  const lens = Math.exp(mix(Math.log(tanHalf(fov)), Math.log(tanHalf(action.to.fov)), e));
  return {
    position: lerp3(start.position, action.to.position, e),
    target: lerp3(start.target, action.to.target, smooth(t)),
    fov: (2 * Math.atan(lens)) / rad,
  };
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
    case "rise":
      return {
        position: lerp3(action.from, action.to.position, smoother(t)),
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
  starts: Record<ScrollPhase, number>;
  total: number;
  actions: Action[];
  /** Where each action starts, in units from the tour's start. */
  at: number[];
  rooms: RevealRoom[];
  /** When the camera first crosses into each room, in units from the stretch's start, and which way. */
  entries: ({ units: number; axis: SweepAxis } | null)[];
  /** When it first stands inside the house. */
  inside: number;
  /** The stretch in a few numbers, for the page. */
  marks: ScrollMarks;
};

/** How finely the camera's way is sampled to find when it crosses into each room, in units. */
const SAMPLE = 0.05;
/**
 * How far its sweep has gone as the camera crosses into a room: its front's soft edge, which runs
 * from before the room to past it, has just gone past the threshold, so the room is in colour as
 * it is walked into, and the front runs on ahead through it.
 */
const crossingReveal = (room: { w: number; d: number }, axis: SweepAxis) => {
  const length = axis === "+x" || axis === "-x" ? room.w : room.d;
  // A little past it: the crossing is found a sample after it happens.
  return Math.min(1, (ROOM_BAND * 2 + SAMPLE * 4) / (length + ROOM_BAND * 2));
};

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
  const tour = sheet + lift + descent;
  const rise = actions.findIndex(({ kind }) => kind === "rise");
  const starts = {
    sheet: 0,
    lift: sheet,
    descent: sheet + lift,
    tour,
    finale: tour + (rise >= 0 ? at[rise]! : walking),
  };
  const total = starts.tour + walking;

  // Along the way on foot: the rooms the camera crosses into, once it is inside the house.
  const rooms = revealRooms(plan);
  const entries: Timeline["entries"] = rooms.map(() => null);
  const storeys = new Set(plan.floors.filter(({ kind }) => kind !== "plot"));
  let inside = Number.POSITIVE_INFINITY;
  let previous: Vec3 | null = null;
  // Each stop's cartela, from when the camera first crosses into its room past the stop before.
  const stops = tourStops(plan);
  const stopRooms = stops.map(({ floor, room }) =>
    rooms.findIndex(({ key }) => key === `${floor.id}/${room.id}`),
  );
  const holds = stops.map((_, index) =>
    actions.findIndex((action) => action.kind === "hold" && action.stop === index),
  );
  const shown = holds.map((hold) => starts.tour + (hold >= 0 ? at[hold]! : walking));
  actions.forEach((action, i) => {
    const steps = Math.max(1, Math.ceil(action.units / SAMPLE));
    for (let s = 0; s <= steps; s++) {
      if (action.kind === "rise") break;
      const { position, heading } = poseOf(action, s / steps);
      const units = starts.tour + at[i]! + (action.units * s) / steps;
      const index = cameraRoomAt(rooms, position);
      if (index >= 0 && storeys.has(rooms[index]!.floor) && units < inside) inside = units;
      const step = previous
        ? { x: position.x - previous.x, z: position.z - previous.z }
        : { x: Math.sin(heading.yaw), z: Math.cos(heading.yaw) };
      // A room's sweep sets off a step before the camera crosses into it, timed for its threshold
      // to be in colour just as it is crossed.
      if (index >= 0 && units >= inside && !entries[index]) {
        const axis = sweepAxis(step);
        entries[index] = { units: units - REVEAL * crossingReveal(rooms[index]!.room, axis), axis };
      }
      // A stop's cartela comes on as its room is crossed into, on the way from the stop before.
      stopRooms.forEach((room, stop) => {
        const after = stop === 0 ? starts.tour : shown[stop - 1]!;
        if (room === index && units > after && units < shown[stop]!) shown[stop] = units;
      });
      previous = position;
    }
  });
  // Outside, the sky, the garden, the porch and the pool, in colour from the first room on: the
  // windows look out onto colour, and only the rooms inside wait their turn.
  rooms.forEach((room, i) => {
    const entry = entries[i];
    if (room.floor.kind === "plot" && (!entry || entry.units > inside) && Number.isFinite(inside)) {
      entries[i] = { units: inside, axis: entry?.axis ?? "+z" };
    }
  });
  // Rising over the house at the end, whatever it has not walked into turns, the last of it.
  rooms.forEach((room, i) => {
    if (!entries[i] && room.under === undefined) {
      entries[i] = { units: starts.finale + RISE * 0.35, axis: "+z" };
    }
  });
  // A double height turns with the room under it.
  rooms.forEach((room, i) => {
    if (room.under !== undefined) entries[i] = entries[room.under] ?? null;
  });

  const middles = actions.flatMap((action, i) =>
    action.kind === "hold" && action.stop !== null
      ? [{ stop: action.stop, middle: starts.tour + at[i]! + action.units / 2 }]
      : [],
  );
  const marks = { total, starts, shown, holds: middles };
  const timeline = { starts, total, actions, at, rooms, entries, inside, marks };
  timelines.set(plan, timeline);
  return timeline;
}

/** The stretch's length, in units: the page gives it its height from this. */
export const modelUnits = (plan: HousePlan) => timelineOf(plan).total;

/** The stretch in a few numbers, for the page to scroll by without the choreography. */
export const scrollMarks = (plan: HousePlan): ScrollMarks => timelineOf(plan).marks;

/** Where a phase starts and ends, as shares of the scroll. */
export function phaseBounds(id: ScrollPhase, plan: HousePlan) {
  const { starts, total } = timelineOf(plan);
  const index = modelPhases.findIndex((phase) => phase.id === id);
  const next = modelPhases[index + 1];
  return { start: starts[id] / total, end: next ? starts[next.id] / total : 1 };
}

/** The phase a point of the scroll is in. */
export const phaseAt = (progress: number, plan: HousePlan): ScrollPhase =>
  phaseOf(progress, scrollMarks(plan));

/** The action under a number of units into the tour, and how far through it. */
function actionAt({ actions, at }: Timeline, units: number) {
  let i = 0;
  while (i < actions.length - 1 && units >= at[i + 1]!) i++;
  const action = actions[i]!;
  return { index: i, action, t: clamp((units - at[i]!) / action.units) };
}

/** Where in the stretch's scroll a stop holds, in its middle: where its controls take the page. */
export const stopProgress = (index: number, plan: HousePlan) =>
  stopMiddle(index, scrollMarks(plan));

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
export const walkFov = (aspect: number) => (aspect < PORTRAIT ? PORTRAIT_WALK_FOV : WALK_FOV);

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
  const sheet = sheetFrame(plan, screen.aspect < PORTRAIT);
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

/** How far past the plot the sheet frames on a screen held upright, in metres. */
const PORTRAIT_SHEET_MARGIN = 0.8;
const grow = ({ x, z, w, d }: { x: number; z: number; w: number; d: number }, by: number) => ({
  x: x - by,
  z: z - by,
  w: w + by * 2,
  d: d + by * 2,
});

/** A screen narrower than this, width over height, is held upright. */
export const PORTRAIT = 0.9;

/**
 * What the sheet frames on the screen, in the world, with the way in at the top: the house with
 * what is built round it, the porch and the pool, and a margin. On a screen held upright, the plot
 * and its trees: the sheet's margins and title would leave the plan too small to read.
 */
export const sheetFrame = (plan: HousePlan, portrait: boolean): Rect =>
  portrait ? grow(plan.plot, PORTRAIT_SHEET_MARGIN) : sheetBounds(plan);

/** What the sheet shows: the ground floor's drawing, its margins and title block included. */
const sheets = new WeakMap<HousePlan, ReturnType<typeof sheetWorldBounds>>();
function sheetBounds(plan: HousePlan) {
  const known = sheets.get(plan);
  if (known) return known;
  const ground = plan.floors.find(({ kind }) => kind !== "plot");
  const bounds = ground ? sheetWorldBounds(planSheet(plan, ground, "")) : plan.plot;
  sheets.set(plan, bounds);
  return bounds;
}

const entranceDistance = (entrance: ReturnType<typeof entranceOf>) =>
  entrance ? flatDistance(entrance.landing, entrance.door) : 0;

/** The camera on the sheet, for what has nothing else. */
const camera0 = (plan: HousePlan, screen: ModelScreen) => aerial(plan, screen, 0, [0.1, 0.5]);

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

/**
 * The stop on screen at a point of the stretch's scroll: from when the camera crosses into its
 * room, until it crosses into the next one's; none before the first, nor once it rises.
 */
export const stopAt = (progress: number, plan: HousePlan, options: ModelOptions = {}) =>
  stopOf(progress, scrollMarks(plan), options);

/** The scene at a point of its stretch's scroll (0–1). Past either end, the first or the last. */
export function modelAt(
  progress: number,
  plan: HousePlan,
  { still = false, screen = DEFAULT_SCREEN }: ModelOptions = {},
): ModelState {
  const timeline = timelineOf(plan);
  const { starts, rooms, entries, inside, marks } = timeline;
  const units = unitsAt(progress, marks, still);
  const phase = phaseUnder(marks, units);

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
    const fov = walkFov(screen.aspect);
    if (action.kind === "rise") {
      // The house whole, its roof terrace in the sun, as the camera rises over it.
      camera = rising({ ...action, to: fitted(action.to, screen.aspect) }, t, fov);
    } else if (units >= starts.finale) {
      // Holding over the house: where the rise left it.
      const rise = timeline.actions.find((one) => one.kind === "rise");
      camera = rise?.kind === "rise" ? fitted(rise.to, screen.aspect) : camera0(plan, screen);
    } else {
      const { position, heading } = poseOf(action, t);
      camera = { position, target: lookAlong(position, heading), fov };
    }
  }

  const reveals = rooms.map((_, i): RoomReveal => {
    const entry = entries[i];
    if (!entry) return { reveal: 0, axis: "+z" };
    const reveal = clamp((units - entry.units) / REVEAL);
    return { reveal: still ? (reveal > 0 ? 1 : 0) : reveal, axis: entry.axis };
  });

  return {
    phase,
    floor: null,
    room: null,
    floors: restingFloors(plan),
    camera,
    cut,
    door: units < starts.tour ? 0 : doorAt(camera.position, plan, units >= inside),
    rooms: reveals,
    stop: stopUnder(marks, units),
  };
}

// ---- The whole house and its floors -----------------------------------------------------------

/** Every floor in its place, whole, without its plan round it. */
const restingFloors = (plan: HousePlan): FloorPose[] =>
  plan.floors.map(({ id }) => ({ id, lift: 0, opacity: 1, plan: 0 }));

/** How far the floors over a picked one rise out of the way, a storey apart from each other. */
const APART = 4;
/** The lens over a picked floor, and how far it tips from straight down. */
const FLOOR_FOV = 30;
const FLOOR_ELEVATION = 80;
/** How far past its plan's marks a floor is framed, in metres. */
const FLOOR_MARGIN = 0.6;

/** What a picked floor frames: its rooms, or Exterior's plot. */
function floorExtent(plan: HousePlan, floor: HousePlan["floors"][number]) {
  if (floor.kind === "plot") return plan.plot;
  const built = floor.rooms.filter(({ kind }) => kind !== "void");
  const x = Math.min(...built.map((room) => room.x));
  const z = Math.min(...built.map((room) => room.z));
  return {
    x,
    z,
    w: Math.max(...built.map((room) => room.x + room.w)) - x,
    d: Math.max(...built.map((room) => room.z + room.d)) - z,
  };
}

/**
 * The camera over a picked floor: almost straight down at its middle, the way in at the top of
 * the screen as on the sheet, far enough for the floor and its plan's margins to fit the area.
 */
function overFloor(
  plan: HousePlan,
  extent: Rect,
  marks: Rect,
  level: number,
  screen: ModelScreen,
  /** On a portrait screen, the rectangle framed instead, the floor and its title block under it. */
  tight?: Rect,
): CameraPose {
  const inward = entranceOf(plan)?.inward ?? { x: 0, z: 1 };
  const right = { x: -inward.z, z: inward.x };
  const along = Math.abs(inward.z) > 0.5;
  // As far either way from the floor's middle as its plan's marks reach, so it stays in the middle.
  const centre = tight
    ? { x: tight.x + tight.w / 2, z: tight.z + tight.d / 2 }
    : { x: extent.x + extent.w / 2, z: extent.z + extent.d / 2 };
  const halfX = tight
    ? tight.w / 2
    : Math.max(centre.x - marks.x, marks.x + marks.w - centre.x) + FLOOR_MARGIN;
  const halfZ = tight
    ? tight.d / 2
    : Math.max(centre.z - marks.z, marks.z + marks.d - centre.z) + FLOOR_MARGIN;
  const tall = 2 * (along ? halfZ : halfX);
  const wide = 2 * (along ? halfX : halfZ);
  const { aspect, area } = screen;
  const frame = Math.max(tall / area.height, wide / (area.width * aspect));
  // The floor in the middle of the area, wherever the area is on the screen.
  const shiftRight = (area.x + area.width / 2 - 0.5) * frame * aspect;
  const shiftUp = (0.5 - (area.y + area.height / 2)) * frame;
  const target = {
    x: centre.x - right.x * shiftRight - inward.x * shiftUp,
    y: level,
    z: centre.z - right.z * shiftRight - inward.z * shiftUp,
  };
  const reach = frame / (2 * tanHalf(FLOOR_FOV));
  const e = FLOOR_ELEVATION * rad;
  return {
    target,
    position: {
      x: target.x - inward.x * reach * Math.cos(e),
      y: target.y + reach * Math.sin(e),
      z: target.z - inward.z * reach * Math.cos(e),
    },
    fov: FLOOR_FOV,
  };
}

/** What a floor's plan's marks cover in the world, worked out once for each floor and layout. */
const marksKnown = {
  landscape: new WeakMap<HousePlan["floors"][number], Rect>(),
  portrait: new WeakMap<HousePlan["floors"][number], Rect>(),
};
function floorMarksWorld(plan: HousePlan, floor: HousePlan["floors"][number], portrait: boolean) {
  const known = marksKnown[portrait ? "portrait" : "landscape"];
  const bounds = known.get(floor) ?? sheetWorldBounds(floorAnnotations(plan, floor, "", portrait));
  known.set(floor, bounds);
  return bounds;
}

/** How far round a storey a portrait screen frames it, past its rooms, in metres. */
const PORTRAIT_FLOOR_MARGIN = 0.9;

/**
 * The camera over a picked floor. On a portrait screen, a floor's grid of axes and dimensions
 * would leave the floor small across the narrow screen: it frames the floor's rooms instead, close,
 * and the title block under them, its axes' bubbles left to the screen's edges.
 */
function floorCamera(
  plan: HousePlan,
  floor: HousePlan["floors"][number],
  level: number,
  screen: ModelScreen,
) {
  const portrait = screen.aspect < PORTRAIT;
  const extent = floorExtent(plan, floor);
  const marks = floorMarksWorld(plan, floor, portrait);
  if (!portrait) return overFloor(plan, extent, marks, level, screen);
  const m = PORTRAIT_FLOOR_MARGIN;
  // The title block lies under the floor, at the marks' far end from the way in: its least z.
  const z0 = Math.min(marks.z, extent.z - m);
  const tight = {
    x: extent.x - m,
    z: z0,
    w: extent.w + 2 * m,
    d: extent.z + extent.d + m - z0,
  };
  return overFloor(plan, extent, marks, level, screen, tight);
}

/** The axis a picked floor is swept along: the way in, as the sheet reads. */
const inwardAxis = (plan: HousePlan): SweepAxis => {
  const { x, z } = entranceOf(plan)?.inward ?? { x: 0, z: 1 };
  return Math.abs(z) >= Math.abs(x) ? (z > 0 ? "+z" : "-z") : x > 0 ? "+x" : "-x";
};

/**
 * The scene with a floor picked from the whole house, settled: the floors over it lifted out of
 * the way, gone; it cut at half its walls' height, in colour, with its plan's axes, dimensions and
 * title round it; the camera almost straight over it. Exterior keeps the house whole, uncut, and
 * frames the plot.
 */
export function floorView(
  plan: HousePlan,
  floorId: string,
  { screen = DEFAULT_SCREEN }: Pick<ModelOptions, "screen"> = {},
): ModelState {
  const whole = modelAt(1, plan, { screen });
  const floor = plan.floors.find(({ id }) => id === floorId);
  if (!floor) return whole;
  const storeys = plan.floors.filter(({ kind }) => kind !== "plot");
  const index = storeys.indexOf(floor);
  const level = index >= 0 ? floorLevel(plan, floor.id) : 0;
  const axis = inwardAxis(plan);
  const { rooms } = timelineOf(plan);
  return {
    ...whole,
    phase: "floor",
    floor: floor.id,
    floors: plan.floors.map((one) => {
      const storey = storeys.indexOf(one);
      const above = index >= 0 && storey > index;
      return {
        id: one.id,
        lift: above ? APART * (storey - index) : 0,
        opacity: above ? 0 : 1,
        plan: one === floor ? 1 : 0,
      };
    }),
    camera: floorCamera(plan, floor, level, screen),
    cut: index >= 0 ? level + WALL_HEIGHT / 2 : NO_CUT,
    rooms: whole.rooms.map((room, i) => (rooms[i]!.floor === floor ? { reveal: 1, axis } : room)),
    stop: null,
  };
}

/** Of a pick's time, how much the camera's move takes, and when the sweep sets off. */
const PICK_MOVE = 0.38;
const PICK_SWEEP = 0.62;

/** A cut eased between two heights, uncut taken as just over the house. */
function cutBetween(plan: HousePlan, a: number, b: number, e: number) {
  const top = builtFloors(plan).length * STOREY_HEIGHT + 1.5;
  const height = mix(Math.min(a, top), Math.min(b, top), e);
  return height >= top - 1e-9 ? NO_CUT : height;
}

export type FloorPick = {
  /** The scene as it was when the floor was picked: where the camera, the floors and the sweeps were. */
  from: ModelState;
  /** The floor picked, or none to go back to the whole house. */
  floor: string | null;
  /** The whole house, as the scroll has it: where «Ver la casa entera» goes. */
  whole: ModelState;
  /** How far through the change it is, 0–1. */
  t: number;
};

/**
 * The scene going from where it was to a floor picked, or back to the whole house, `t` of the way.
 * The camera moves, the floors over the picked one rise and fade and the others come back, and the
 * cut comes down to it; meanwhile its rooms turn back into ink, its plan's axes and dimensions are
 * drawn round it, and once the camera is over it, the sweep turns it into 3D. With reduced motion,
 * the destination, for the view to fade to.
 */
export function pickAt(
  plan: HousePlan,
  { from, floor, whole, t }: FloorPick,
  { still = false, screen = DEFAULT_SCREEN }: ModelOptions = {},
): ModelState {
  const to = floor ? floorView(plan, floor, { screen }) : whole;
  if (still || t >= 1) return to;
  const c = clamp(t);
  const e = smoother(floor ? c / PICK_MOVE : c);
  const { rooms } = timelineOf(plan);
  const picked = plan.floors.find(({ id }) => id === floor);
  const lens = Math.exp(
    mix(Math.log(tanHalf(from.camera.fov)), Math.log(tanHalf(to.camera.fov)), e),
  );
  const drawn = smooth((c - PICK_MOVE * 0.5) / (PICK_MOVE * 0.5));
  const swept = smooth((c - PICK_SWEEP) / (1 - PICK_SWEEP));
  return {
    ...to,
    camera:
      e === 0
        ? from.camera
        : {
            position: lerp3(from.camera.position, to.camera.position, e),
            target: lerp3(from.camera.target, to.camera.target, e),
            fov: (2 * Math.atan(lens)) / rad,
          },
    floors: to.floors.map((pose, i) => {
      const was = from.floors[i] ?? pose;
      return {
        id: pose.id,
        lift: mix(was.lift, pose.lift, e),
        opacity: mix(was.opacity, pose.opacity, e),
        plan: pose.id === floor ? Math.max(was.plan, drawn) : mix(was.plan, pose.plan, e),
      };
    }),
    cut: cutBetween(plan, from.cut, to.cut, e),
    rooms: to.rooms.map((room, i) => {
      const was = from.rooms[i] ?? room;
      if (picked && rooms[i]!.floor === picked) {
        // Back into ink as the camera comes over it, then swept into colour.
        const reveal = c < PICK_MOVE ? was.reveal * (1 - e) : swept * room.reveal;
        return { reveal, axis: c < PICK_MOVE ? was.axis : room.axis };
      }
      return { reveal: mix(was.reveal, room.reveal, e), axis: room.axis };
    }),
  };
}

// ---- A room of a picked floor -----------------------------------------------------------------

/**
 * Going into a room of a picked floor, or back out to it: `from` and `to` how far in, 0 over the
 * floor and 1 inside, and `t` how far through the change.
 */
export type RoomEntry = { floor: string; room: string; from: number; to: 0 | 1; t: number };

/** Of the way in, how much the camera's descent takes: then the floors over the room come back. */
const DESCENT = 0.72;

/**
 * The scene `s` of the way into a room of a picked floor (0–1). The camera comes over the room
 * first and then down into it, at eye height, turning to its viewpoint as it does; the cut rises
 * to its ceiling, so its walls grow round the camera, and the floors over it, out of the way while
 * it comes down through them, land back in place once it is in, as its ceiling. Going out is the
 * same way, backwards.
 */
function goingIn(
  plan: HousePlan,
  over: ModelState,
  floor: PlanFloor,
  room: Room,
  s: number,
  screen: ModelScreen,
): ModelState {
  const view = entryViewpoint(plan, floor, room);
  const level = floorLevel(plan, floor.id);
  const storeys = builtFloors(plan);
  // The plot is at the ground floor's level: what is over the ground floor is over it.
  const standing = floor.kind === "plot" ? 0 : storeys.indexOf(floor);
  const u = clamp(s / DESCENT);
  const v = clamp((s - DESCENT) / (1 - DESCENT));
  const across = smoother(u / 0.55);
  const down = smoother((u - 0.12) / 0.88);
  const start = over.camera;
  // Weighted at both ends, to land exactly on the viewpoint.
  const weigh = (a: number, b: number, e: number) => a * (1 - e) + b * e;
  const lens = Math.exp(
    mix(Math.log(tanHalf(start.fov)), Math.log(tanHalf(walkFov(screen.aspect))), down),
  );
  const camera: CameraPose = {
    position: {
      x: weigh(start.position.x, view.from.x, across),
      y: weigh(start.position.y, view.from.y, down),
      z: weigh(start.position.z, view.from.z, across),
    },
    target: {
      x: weigh(start.target.x, view.to.x, down),
      y: weigh(start.target.y, view.to.y, down),
      z: weigh(start.target.z, view.to.z, down),
    },
    fov: (2 * Math.atan(lens)) / rad,
  };
  const away = smooth(u / 0.25);
  const floors = over.floors.map((pose): FloorPose => {
    const storey = storeys.findIndex(({ id }) => id === pose.id);
    const plan = pose.id === floor.id ? pose.plan * (1 - smooth((u - 0.5) / 0.5)) : 0;
    if (storey <= standing) return { ...pose, plan };
    if (s >= DESCENT) return { id: pose.id, lift: 0, opacity: smooth(v), plan: 0 };
    return {
      id: pose.id,
      lift: mix(pose.lift, APART * (storey - standing), away),
      opacity: pose.opacity * (1 - away),
      plan,
    };
  });
  const ceiling = level + STOREY_HEIGHT - 0.02;
  return {
    ...over,
    phase: s > 0 ? "room" : over.phase,
    room: s > 0 ? room.id : null,
    camera,
    floors,
    cut: s >= DESCENT ? NO_CUT : cutBetween(plan, over.cut, ceiling, smooth(u)),
  };
}

/**
 * The scene going into a room of a picked floor, or back out over it. With reduced motion, where
 * it goes, for the view to fade to.
 */
export function enterAt(
  plan: HousePlan,
  { floor: floorId, room: roomId, from, to, t }: RoomEntry,
  { still = false, screen = DEFAULT_SCREEN }: ModelOptions = {},
): ModelState {
  const over = floorView(plan, floorId, { screen });
  const floor = plan.floors.find(({ id }) => id === floorId);
  const room = floor?.rooms.find(({ id }) => id === roomId);
  if (!floor || !room) return over;
  const s = still ? to : mix(from, to, clamp(t));
  if (s <= 0) return over;
  return goingIn(plan, over, floor, room, s, screen);
}
