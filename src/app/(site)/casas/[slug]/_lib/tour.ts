import { floorGeometry, stairEntry, type OpeningGeometry } from "@/features/houses/plan";
import type { HousePlan, PlanFloor, PlanPoint, PlanView, Room } from "@/features/houses/schema";
import { formatArea, formatLength } from "@/lib/format";

import { STOREY_HEIGHT } from "./model-geometry";

// The tour through a house type's model (ADR 0009): its stops, each a room seen from a viewpoint
// with its cartela, and the way the camera takes between them. Pure, from the plan: every room has
// a view worked out from it (from its main door, at eye height, towards its main window), which
// the plan can set by hand, and so can each stop. In the world's metres: x east, y up from the
// ground floor's finished floor, z south.

/** Where a visitor's eyes are, over the floor they stand on. */
export const EYE_HEIGHT = 1.6;
/** What a view looks at, over the floor: through the middle of a window. */
const LOOK_HEIGHT = 1.3;
/** How far into a room its view stands from the door, and how far it keeps from any wall. */
const STEP_IN = 0.7;
const CLEARANCE = 0.35;
const EPS = 1e-6;

/** A point in the world: the plan's, with `y` from +0,00 rather than from its floor. */
export type Vec3 = PlanPoint;
/** A camera's eye and the point it looks at, in the world (glossary: Punto de vista). */
export type Viewpoint = PlanView;

/** A stop's cartela: the room's name and figures from the plan, and the stop's line. */
export type Caption = {
  name: string;
  /** The floor it is on: «Planta baja». */
  floor: string;
  /** «33,6 m²». */
  area: string;
  /** «orientación suroeste». */
  orientation: string;
  line: string;
  /** A figure of its own, if it has one: «6,4 m de altura». */
  fact?: string;
};

export type Stop = {
  floor: PlanFloor;
  room: Room;
  view: Viewpoint;
  /**
   * The camera's way here, from the stop before (or, for the first, from where the descent lands
   * and in through the front door): every point it passes, ending on this stop's eye.
   */
  path: Vec3[];
  caption: Caption;
};

const builtFloors = (plan: HousePlan) => plan.floors.filter(({ kind }) => kind !== "plot");

/** Where a floor's finished floor stands: the plot and the ground floor at +0,00. */
export function floorLevel(plan: HousePlan, floorId: string) {
  const index = builtFloors(plan).findIndex(({ id }) => id === floorId);
  // To the millimetre: 3 × 3,2 is 9,6, not 9,600000000000001.
  return Math.round(Math.max(index, 0) * STOREY_HEIGHT * 1000) / 1000;
}

type Flat = { x: number; z: number };
type Gap = { x1: number; z1: number; x2: number; z2: number };

const middle = ({ x1, z1, x2, z2 }: Gap): Flat => ({ x: (x1 + x2) / 2, z: (z1 + z2) / 2 });
const width = ({ x1, z1, x2, z2 }: Gap) => Math.abs(x2 - x1) + Math.abs(z2 - z1);

/** Whether a gap lies along one of a room's sides. */
function touches(room: Room, gap: Gap) {
  const within = (a: number, b: number, from: number, size: number) =>
    Math.min(a, b) >= from - EPS && Math.max(a, b) <= from + size + EPS;
  if (Math.abs(gap.z1 - gap.z2) < EPS) {
    const onSide = [room.z, room.z + room.d].some((z) => Math.abs(gap.z1 - z) < EPS);
    return onSide && within(gap.x1, gap.x2, room.x, room.w);
  }
  const onSide = [room.x, room.x + room.w].some((x) => Math.abs(gap.x1 - x) < EPS);
  return onSide && within(gap.z1, gap.z2, room.z, room.d);
}

/** Into the room from a gap on one of its sides, as a unit step on the plan. */
function inward(room: Room, gap: Gap): Flat {
  if (Math.abs(gap.z1 - gap.z2) < EPS) return { x: 0, z: Math.abs(gap.z1 - room.z) < EPS ? 1 : -1 };
  return { x: Math.abs(gap.x1 - room.x) < EPS ? 1 : -1, z: 0 };
}

/** The same point, kept clear of the room's walls. */
function inside(room: Room, { x, z }: Flat): Flat {
  const keep = (value: number, from: number, size: number) => {
    const margin = Math.min(CLEARANCE, size / 2 - EPS);
    return Math.min(Math.max(value, from + margin), from + size - margin);
  };
  return { x: keep(x, room.x, room.w), z: keep(z, room.z, room.d) };
}

/** Where two rooms meet along a side, if they do: how open-air rooms run into each other. */
function sharedSide(a: Room, b: Room): Gap | undefined {
  const overlap = (p: number, ps: number, q: number, qs: number) => {
    const from = Math.max(p, q);
    const to = Math.min(p + ps, q + qs);
    return to > from + EPS ? { from, to } : undefined;
  };
  for (const [line, other] of [
    [a.z + a.d, b.z],
    [a.z, b.z + b.d],
  ] as const) {
    const span = Math.abs(line - other) < EPS && overlap(a.x, a.w, b.x, b.w);
    if (span) return { x1: span.from, z1: line, x2: span.to, z2: line };
  }
  for (const [line, other] of [
    [a.x + a.w, b.x],
    [a.x, b.x + b.w],
  ] as const) {
    const span = Math.abs(line - other) < EPS && overlap(a.z, a.d, b.z, b.d);
    if (span) return { x1: line, z1: span.from, x2: line, z2: span.to };
  }
  return undefined;
}

const PASSABLE: OpeningGeometry["kind"][] = ["door", "passage", "sliding"];
const isRoom = (room: Room) => room.kind !== "garden" && room.kind !== "void";

/**
 * Each room's main door: the way in on the shortest walk from where its floor is arrived at, the
 * front door or the stair. Open-air rooms with no wall between them run into each other.
 */
function mainDoors(plan: HousePlan, floor: PlanFloor, openings: OpeningGeometry[]) {
  const rooms = floor.rooms.filter(isRoom);
  const doors = new Map<Room, Gap>();
  const entrance = openings.find(({ kind }) => kind === "entrance");
  const stair = rooms.find(({ kind }) => kind === "stair");
  const queue: Room[] = [];
  if (entrance) {
    const hall = rooms.find((room) => touches(room, entrance));
    if (hall) {
      doors.set(hall, entrance);
      queue.push(hall);
    }
  } else if (stair) {
    // Arrived at up the stair: at the end it is stepped off at.
    const side = stairEntry(floor) ?? "south";
    const [x1, z1, x2, z2] = {
      north: [stair.x, stair.z, stair.x + stair.w, stair.z],
      south: [stair.x, stair.z + stair.d, stair.x + stair.w, stair.z + stair.d],
      west: [stair.x, stair.z, stair.x, stair.z + stair.d],
      east: [stair.x + stair.w, stair.z, stair.x + stair.w, stair.z + stair.d],
    }[side];
    doors.set(stair, { x1, z1, x2, z2 });
    queue.push(stair);
  }
  while (queue.length > 0) {
    const room = queue.shift()!;
    for (const other of rooms) {
      if (doors.has(other)) continue;
      const opening = openings.find(
        (gap) => PASSABLE.includes(gap.kind) && touches(room, gap) && touches(other, gap),
      );
      const side = !opening && room.open && other.open ? sharedSide(room, other) : undefined;
      const way = opening ?? side;
      if (!way) continue;
      doors.set(other, way);
      queue.push(other);
    }
  }
  return doors;
}

/** Its windows and sliding doors, the widest first, low windows before high ones. */
function outerOpenings(room: Room, openings: OpeningGeometry[]) {
  return openings
    .filter(({ kind }) => kind === "window" || kind === "sliding")
    .filter((gap) => touches(room, gap))
    .sort((a, b) => {
      const high = (gap: OpeningGeometry) => ((gap.sill ?? 0) >= 1.5 ? 1 : 0);
      return high(a) - high(b) || width(b) - width(a);
    });
}

const sameSide = (room: Room, a: Gap, b: Gap) => {
  const [p, q] = [inward(room, a), inward(room, b)];
  const horizontal = (gap: Gap) => Math.abs(gap.z1 - gap.z2) < EPS;
  return horizontal(a) === horizontal(b) && p.x === q.x && p.z === q.z && touches(room, a);
};

/** A room's view as the plan gives it: from its main door, at eye height, towards its main window. */
function workedOutView(plan: HousePlan, floor: PlanFloor, room: Room): Viewpoint {
  const { openings } = floorGeometry(floor, plan);
  const door = mainDoors(plan, floor, openings).get(room);
  const windows = outerOpenings(room, openings);
  const level = floorLevel(plan, floor.id);
  const at = ({ x, z }: Flat, y: number): Vec3 => ({ x, y: level + y, z });
  const centre = { x: room.x + room.w / 2, z: room.z + room.d / 2 };

  // Towards the main window, unless it is in the door's own wall and another is not.
  const window =
    (door && windows.find((gap) => !sameSide(room, gap, door))) ?? windows[0] ?? undefined;
  let eye: Flat;
  if (door && !(window && sameSide(room, window, door))) {
    const step = inward(room, door);
    const { x, z } = middle(door);
    eye = inside(room, { x: x + step.x * STEP_IN, z: z + step.z * STEP_IN });
  } else if (window) {
    // No door, or the window beside it: from across the room, facing it.
    const step = inward(room, window);
    const { x, z } = middle(window);
    eye = inside(room, { x: x + step.x * room.w * 2, z: z + step.z * room.d * 2 });
  } else {
    // Along its longer side, from one end.
    eye = inside(room, room.d >= room.w ? { x: centre.x, z: room.z } : { x: room.x, z: centre.z });
  }
  if (window) return { from: at(eye, EYE_HEIGHT), to: at(middle(window), LOOK_HEIGHT) };

  // No window: at the far opening, or across the room.
  const far = openings
    .filter((gap) => touches(room, gap) && gap !== door)
    .map(middle)
    .sort((a, b) => Math.hypot(b.x - eye.x, b.z - eye.z) - Math.hypot(a.x - eye.x, a.z - eye.z))[0];
  const across = {
    x: centre.x + (centre.x - eye.x),
    z: centre.z + (centre.z - eye.z),
  };
  return { from: at(eye, EYE_HEIGHT), to: at(far ?? across, LOOK_HEIGHT) };
}

const overFloor = (level: number, { from, to }: PlanView): Viewpoint => ({
  from: { ...from, y: level + from.y },
  to: { ...to, y: level + to.y },
});

/** A room's view: set by hand on the plan, or worked out from it. */
export function roomViewpoint(plan: HousePlan, floor: PlanFloor, room: Room): Viewpoint {
  if (room.view) return overFloor(floorLevel(plan, floor.id), room.view);
  return workedOutView(plan, floor, room);
}

const overlaps = (a: Room, b: Room) =>
  a.x < b.x + b.w - EPS && b.x < a.x + a.w - EPS && a.z < b.z + b.d - EPS && b.z < a.z + a.d - EPS;

/** A room's figure of its own, from the plan: a double height's. */
function factOf(plan: HousePlan, floor: PlanFloor, room: Room) {
  const built = builtFloors(plan);
  const above = built[built.indexOf(floor) + 1];
  const rises = above?.rooms.some((other) => other.kind === "void" && overlaps(other, room));
  return rises ? `${formatLength(STOREY_HEIGHT * 2)} de altura` : undefined;
}

function captionOf(plan: HousePlan, floor: PlanFloor, room: Room, line: string): Caption {
  const area = floorGeometry(floor, plan).rooms.find(({ id }) => id === room.id)!.area;
  const fact = factOf(plan, floor, room);
  return {
    name: room.name,
    floor: floor.name,
    area: formatArea(area),
    orientation: `orientación ${room.orientation.toLowerCase()}`,
    line,
    ...(fact && { fact }),
  };
}

/** How far in front of its front door the descent lands the camera, at eye height. */
export const LANDING_DISTANCE = 7;

/** The way into the house: its front door, the way in through it, and where the descent lands. */
export type Entrance = {
  /** The middle of the front door, at eye height. */
  door: Vec3;
  /** Into the house through the door, as a unit step on the plan. */
  inward: { x: number; z: number };
  /** In front of the door, at eye height, facing it. */
  landing: Vec3;
};

const entrances = new WeakMap<HousePlan, Entrance | null>();

/** The house's front door, on its ground floor, if the plan has one. Worked out once per plan. */
export function entranceOf(plan: HousePlan): Entrance | null {
  if (entrances.has(plan)) return entrances.get(plan)!;
  const ground = builtFloors(plan)[0];
  const opening =
    ground && floorGeometry(ground, plan).openings.find(({ kind }) => kind === "entrance");
  const hall = opening && ground.rooms.find((room) => isRoom(room) && touches(room, opening));
  let entrance: Entrance | null = null;
  if (opening && hall) {
    const step = inward(hall, opening);
    const { x, z } = middle(opening);
    entrance = {
      door: { x, y: EYE_HEIGHT, z },
      inward: step,
      landing: {
        x: x - step.x * LANDING_DISTANCE,
        y: EYE_HEIGHT,
        z: z - step.z * LANDING_DISTANCE,
      },
    };
  }
  entrances.set(plan, entrance);
  return entrance;
}

const tours = new WeakMap<HousePlan, Stop[]>();

/** The plan's tour, stop by stop; none if it declares none. Worked out once for each plan. */
export function tourStops(plan: HousePlan): Stop[] {
  const known = tours.get(plan);
  if (known) return known;
  const stops: Stop[] = [];
  for (const stop of plan.tour ?? []) {
    const floor = plan.floors.find(({ id }) => id === stop.floor);
    const room = floor?.rooms.find(({ id }) => id === stop.room);
    // The plan's validation names what is missing; a broken stop is left out here.
    if (!floor || !room) continue;
    const view = stop.view
      ? overFloor(floorLevel(plan, floor.id), stop.view)
      : roomViewpoint(plan, floor, room);
    const via = (stop.via ?? []).map(({ floor, x, z, y }) => ({
      x,
      y: floorLevel(plan, floor) + (y ?? EYE_HEIGHT),
      z,
    }));
    // The first stop is walked to from where the descent lands, in through the front door.
    const entrance = entranceOf(plan);
    const before = stops.at(-1)?.view.from;
    const from = before ? [before] : entrance ? [entrance.landing, entrance.door] : [];
    stops.push({
      floor,
      room,
      view,
      path: [...from, ...via, view.from],
      caption: captionOf(plan, floor, room, stop.line),
    });
  }
  tours.set(plan, stops);
  return stops;
}
