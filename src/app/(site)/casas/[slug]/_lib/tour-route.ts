import { floorGeometry, stairEntry } from "@/features/houses/plan";
import type { HousePlan, PlanFloor, Rect, Room } from "@/features/houses/schema";

import { floorModel, SLIDING_CLOSED, STOREY_HEIGHT, type Box } from "./model-geometry";
import { furnitureSolids } from "./plan-sheet";
import {
  builtFloors,
  entranceOf,
  EYE_HEIGHT,
  floorLevel,
  inward,
  middle,
  PASSABLE,
  sharedSide,
  touches,
  tourStops,
  type Flat,
  type Gap,
  type Vec3,
} from "./tour";

// The way the tour's camera walks from one stop to the next (ADR 0010), worked out from the plan:
// from room to room through the openings, up and down the stair's flights, on the shortest walk;
// then pulled taut, every point it can do without dropped as long as the straight line that takes
// its place keeps clear of the walls, so the camera only turns where the house makes it turn.
// A stop whose plan declares its way (`via`) keeps it as declared.

/** How far before and after an opening the camera lines up with it, square on. */
const APPROACH = 0.5;
/** How far the camera keeps from a wall, a pane or a railing; and from a jamb, crossing. */
const CLEARANCE = 0.25;
const NEAR_CLEARANCE = 0.12;
const JAMB = 0.4;
const FURNITURE_CLEARANCE = 0.15;
/** How much longer the way through a sliding door counts: an inner door is the way in. */
const SLIDING_DETOUR = 6;
/** How finely a straight line is checked for walls. */
const STEP = 0.08;
const EPS = 1e-6;

/** A room the camera can stand in, on its floor, at its floor's level. */
type Place = { key: string; floor: PlanFloor; room: Room; level: number };

/** An opening's stretch the camera can cross, kept clear of its jambs, and the way across it. */
type Crossing = { a: Flat; b: Flat; normal: Flat };

/** A way from one place to the next: through an opening, or up or down a stair. */
type Link = {
  to: Place;
  points: Vec3[];
  fixed: boolean;
  crossing?: Crossing;
  /** Metres the shortest way counts it longer than it is: a sliding door's. */
  penalty?: number;
};

/** A point of a way: kept where it is on a stair, slid along its opening on a crossing. */
type WayPoint = { at: Vec3; fixed: boolean; crossing?: Crossing };

const isPlace = (room: Room) =>
  room.kind !== "void" && room.kind !== "garden" && room.kind !== "pool";

const inRect = (room: { x: number; z: number; w: number; d: number }, { x, z }: Flat, by = 0) =>
  x > room.x - by && x < room.x + room.w + by && z > room.z - by && z < room.z + room.d + by;

type Walk = {
  places: Place[];
  links: Map<Place, Link[]>;
  /** What the camera keeps clear of on each floor's level: walls, panes, railings, planters. */
  obstacles: Map<number, Box[]>;
  /** Where it cannot stand on each level: double heights and the pool. */
  holes: Map<number, Rect[]>;
  /** The furniture on each level, which it walks round. */
  furniture: Map<number, Rect[]>;
};

/** A stair's way up from its floor to the next: up its first flight, across, up its second. */
function stairWay(floor: PlanFloor, stair: Room, level: number): Vec3[] | null {
  const entry = stairEntry(floor);
  if (!entry) return null;
  const alongZ = stair.d >= stair.w;
  const length = alongZ ? stair.d : stair.w;
  const half = (alongZ ? stair.w : stair.d) / 2;
  const fromStart = entry === "north" || entry === "west";
  // Along the well from its entry end, across it from its first side.
  const at = (along: number, across: number, y: number): Vec3 => {
    const a = fromStart ? along : length - along;
    return alongZ
      ? { x: stair.x + across, y, z: stair.z + a }
      : { x: stair.x + a, y, z: stair.z + across };
  };
  const foot = 0.35;
  const landing = length - 0.5;
  const eye = level + EYE_HEIGHT;
  return [
    at(foot, half / 2, eye),
    at(landing, half / 2, eye + STOREY_HEIGHT / 2),
    at(landing, half * 1.5, eye + STOREY_HEIGHT / 2),
    at(foot, half * 1.5, eye + STOREY_HEIGHT),
  ];
}

const walks = new WeakMap<HousePlan, Walk>();

function walkOf(plan: HousePlan): Walk {
  const known = walks.get(plan);
  if (known) return known;
  const storeys = builtFloors(plan);
  const plot = plan.floors.find(({ kind }) => kind === "plot");
  const places: Place[] = [];
  const add = (floor: PlanFloor, level: number) => {
    for (const room of floor.rooms.filter(isPlace)) {
      places.push({ key: `${floor.id}/${room.id}`, floor, room, level });
    }
  };
  storeys.forEach((floor) => add(floor, floorLevel(plan, floor.id)));
  if (plot) add(plot, 0);
  const links = new Map<Place, Link[]>(places.map((place) => [place, []]));
  const through = (a: Place, b: Place, whole: Gap, sliding = false) => {
    // A sliding door is crossed by its open half; and only where no other way will do.
    const gap = sliding
      ? {
          x1: whole.x1 + (whole.x2 - whole.x1) * SLIDING_CLOSED,
          z1: whole.z1 + (whole.z2 - whole.z1) * SLIDING_CLOSED,
          x2: whole.x2,
          z2: whole.z2,
        }
      : whole;
    const mid = middle(gap);
    const normal = inward(b.room, gap);
    const along = { x: gap.x2 - gap.x1, z: gap.z2 - gap.z1 };
    const width = Math.hypot(along.x, along.z);
    const unit = { x: along.x / width, z: along.z / width };
    // Clear of each jamb by a margin, or at the middle of a narrow one.
    const keep = Math.min(JAMB, width / 2);
    const crossing = {
      a: { x: gap.x1 + unit.x * keep, z: gap.z1 + unit.z * keep },
      b: { x: gap.x2 - unit.x * keep, z: gap.z2 - unit.z * keep },
      normal,
    };
    const point = { x: mid.x, y: a.level + EYE_HEIGHT, z: mid.z };
    links.get(a)!.push({
      to: b,
      points: [point],
      fixed: false,
      crossing,
      ...(sliding && { penalty: SLIDING_DETOUR }),
    });
  };

  // On each floor, and from the ground floor out onto the plot: through every passable opening,
  // and between open-air rooms with no wall between them.
  const ground = storeys[0];
  for (const floor of storeys) {
    const level = floorLevel(plan, floor.id);
    const here = places.filter((place) => place.floor === floor);
    const outside = floor === ground ? places.filter((place) => place.floor === plot) : [];
    const { openings } = floorGeometry(floor, plan);
    const passable = openings.filter(({ kind }) => PASSABLE.includes(kind));
    for (const a of [...here, ...outside]) {
      for (const b of [...here, ...outside]) {
        if (a === b) continue;
        const gap = passable.find(
          (opening) => touches(a.room, opening) && touches(b.room, opening),
        );
        const open = !gap && a.room.open && b.room.open && a.level === b.level;
        const way = gap ?? (open ? sharedSide(a.room, b.room) : undefined);
        if (way) through(a, b, way, gap?.kind === "sliding");
      }
    }
    // Up the stair to the floor above, and back down.
    const stair = here.find(({ room }) => room.kind === "stair");
    const next = storeys[storeys.indexOf(floor) + 1];
    const up = next && places.find((place) => place.floor === next && place.room.kind === "stair");
    const way = stair && up && stairWay(floor, stair.room, level);
    if (stair && up && way) {
      links.get(stair)!.push({ to: up, points: way, fixed: true });
      links.get(up)!.push({ to: stair, points: [...way].reverse(), fixed: true });
    }
  }

  const obstacles = new Map<number, Box[]>();
  const holes = new Map<number, Rect[]>();
  const furniture = new Map<number, Rect[]>();
  storeys.forEach((floor, i) => {
    const level = floorLevel(plan, floor.id);
    const model = floorModel(plan, floor, { next: storeys[i + 1], below: storeys[i - 1] });
    // Every pane stands in the way, a sliding door's closed half's too.
    const panes = model.glass;
    const lifted = [...model.walls, ...panes].map((box) => ({ ...box, y: box.y + level }));
    obstacles.set(level, lifted);
    holes.set(
      level,
      floor.rooms.filter(({ kind }) => kind === "void"),
    );
    // The furniture: the camera walks round it, not through it, a little closer than to a wall.
    furniture.set(
      level,
      furnitureSolids(plan, floor)
        .filter(({ h, y }) => h > 0.1 && y < 1)
        .map(({ x, z, w, d }) => ({ x, z, w, d })),
    );
  });
  const pool = plot?.rooms.filter(({ kind }) => kind === "pool") ?? [];
  holes.set(0, [...(holes.get(0) ?? []), ...pool]);

  const walk = { places, links, obstacles, holes, furniture };
  walks.set(plan, walk);
  return walk;
}

/** The place a point stands in: the room on its level whose rectangle holds it. */
function placeAt({ places }: Walk, point: Vec3) {
  const level = Math.max(0, Math.round((point.y - EYE_HEIGHT) / STOREY_HEIGHT)) * STOREY_HEIGHT;
  const near = (place: Place) => Math.abs(place.level - level) < 0.01;
  // The house's rooms before the plot's.
  return (
    places.find(
      (place) => near(place) && place.floor.kind !== "plot" && inRect(place.room, point),
    ) ?? places.find((place) => near(place) && inRect(place.room, point))
  );
}

const distance = (a: Vec3, b: Vec3) => Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);

/** The shortest way between two places, link by link, from a point to a point. */
function shortest(walk: Walk, from: Place, start: Vec3, to: Place, end: Vec3) {
  const best = new Map<Place, { cost: number; at: Vec3; via: Link[] }>();
  best.set(from, { cost: 0, at: start, via: [] });
  const open = [from];
  while (open.length > 0) {
    open.sort((a, b) => best.get(a)!.cost - best.get(b)!.cost);
    const place = open.shift()!;
    const here = best.get(place)!;
    if (place === to) break;
    for (const link of walk.links.get(place) ?? []) {
      const first = link.points[0]!;
      const last = link.points.at(-1)!;
      let length = distance(here.at, first);
      for (let i = 1; i < link.points.length; i++) {
        length += distance(link.points[i - 1]!, link.points[i]!);
      }
      const cost = here.cost + length + (link.penalty ?? 0);
      const known = best.get(link.to);
      if (known && known.cost <= cost) continue;
      best.set(link.to, { cost, at: last, via: [...here.via, link] });
      if (!open.includes(link.to)) open.push(link.to);
    }
  }
  const found = best.get(to);
  return found && { links: found.via, cost: found.cost + distance(found.at, end) };
}

/** Whether the camera walks clear on a straight line, at eye height on one level. */
function clear(walk: Walk, a: Vec3, b: Vec3, clearance = CLEARANCE) {
  if (Math.abs(a.y - b.y) > EPS) return false;
  const level = Math.round((a.y - EYE_HEIGHT) / STOREY_HEIGHT) * STOREY_HEIGHT;
  const boxes = walk.obstacles.get(level) ?? [];
  const holes = walk.holes.get(level) ?? [];
  const furniture = walk.furniture.get(level) ?? [];
  const steps = Math.max(1, Math.ceil(distance(a, b) / STEP));
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const point = { x: a.x + (b.x - a.x) * t, y: a.y, z: a.z + (b.z - a.z) * t };
    for (const box of boxes) {
      if (point.y < box.y || point.y > box.y + box.h) continue;
      if (inRect(box, point, clearance)) return false;
    }
    if (holes.some((hole) => inRect(hole, point, clearance))) return false;
    if (furniture.some((piece) => inRect(piece, point, Math.min(clearance, FURNITURE_CLEARANCE)))) {
      return false;
    }
  }
  return true;
}

/**
 * The points of a way, pulled taut: from each point kept, straight to the farthest one it can
 * reach clear of the walls. The stair's points are all kept: its flights are where they are.
 */
function taut(walk: Walk, points: WayPoint[]): WayPoint[] {
  const kept: WayPoint[] = [points[0]!];
  let i = 0;
  while (i < points.length - 1) {
    let j = i + 1;
    if (!points[i]!.fixed && !points[j]!.fixed) {
      for (let k = points.length - 1; k > i + 1; k--) {
        const between = points.slice(i + 1, k);
        if (between.some(({ fixed }) => fixed) || points[k]!.fixed) continue;
        if (clear(walk, points[i]!.at, points[k]!.at)) {
          j = k;
          break;
        }
      }
    }
    kept.push(points[j]!);
    i = j;
  }
  return kept;
}

/** Where on a line through two points it meets another line, as a share along the second. */
function meeting(p: Flat, q: Flat, a: Flat, b: Flat) {
  const r = { x: q.x - p.x, z: q.z - p.z };
  const s = { x: b.x - a.x, z: b.z - a.z };
  const cross = r.x * s.z - r.z * s.x;
  if (Math.abs(cross) < EPS) return 0.5;
  return ((a.x - p.x) * r.z - (a.z - p.z) * r.x) / cross;
}

/** Each crossing slid along its opening to where the way through it runs straightest. */
function slide(points: WayPoint[]) {
  for (let pass = 0; pass < 4; pass++) {
    for (let i = 1; i < points.length - 1; i++) {
      const { crossing, at } = points[i]!;
      if (!crossing) continue;
      const [before, after] = [points[i - 1]!.at, points[i + 1]!.at];
      const t = Math.min(Math.max(meeting(before, after, crossing.a, crossing.b), 0), 1);
      points[i] = {
        ...points[i]!,
        at: {
          x: crossing.a.x + (crossing.b.x - crossing.a.x) * t,
          y: at.y,
          z: crossing.a.z + (crossing.b.z - crossing.a.z) * t,
        },
      };
    }
  }
  return points;
}

/** Where a straight line through an opening would graze its jamb, the camera lines up first. */
function squareUp(walk: Walk, points: WayPoint[]) {
  const out: WayPoint[] = [];
  points.forEach((point, i) => {
    const { crossing, at } = point;
    const [before, after] = [points[i - 1]?.at, points[i + 1]?.at];
    const grazes =
      crossing &&
      ((before && !clear(walk, before, at, NEAR_CLEARANCE)) ||
        (after && !clear(walk, at, after, NEAR_CLEARANCE)));
    if (!grazes) return out.push(point);
    const off = (by: number): Vec3 => ({
      x: at.x + crossing.normal.x * by,
      y: at.y,
      z: at.z + crossing.normal.z * by,
    });
    // Lined up before and after it, unless the way starts or ends right there.
    const room = APPROACH + 0.3;
    if (before && distance(before, at) > room) out.push({ at: off(-APPROACH), fixed: true });
    out.push({ at, fixed: true });
    if (after && distance(at, after) > room) out.push({ at: off(APPROACH), fixed: true });
  });
  return out;
}

/** The camera's way between two points of the house, through its openings and up its stair. */
export function routeBetween(plan: HousePlan, start: Vec3, end: Vec3): Vec3[] | null {
  const walk = walkOf(plan);
  const from = placeAt(walk, start);
  const to = placeAt(walk, end);
  if (!from || !to) return null;
  const found = shortest(walk, from, start, to, end);
  if (!found) return null;
  const points: WayPoint[] = [
    { at: start, fixed: false },
    ...found.links.flatMap((link) =>
      link.points.map((at) => ({ at, fixed: link.fixed, crossing: link.crossing })),
    ),
    { at: end, fixed: false },
  ];
  const pulled = squareUp(walk, slide(taut(walk, slide(points))));
  return pulled
    .map(({ at }) => at)
    .filter((point, i, all) => i === 0 || distance(all[i - 1]!, point) > 0.01);
}

const ways = new WeakMap<HousePlan, Vec3[][]>();

/**
 * Each stop's way, from the stop before (for the first, from where the descent lands and in
 * through the front door): as its plan declares it, or worked out.
 */
export function tourWays(plan: HousePlan): Vec3[][] {
  const known = ways.get(plan);
  if (known) return known;
  const stops = tourStops(plan);
  const entrance = entranceOf(plan);
  const declared = plan.tour ?? [];
  const worked = stops.map((stop, i) => {
    const via = declared.find(
      (entry) => entry.room === stop.room.id && entry.floor === stop.floor.id,
    )?.via;
    if (via) return stop.path;
    if (i === 0 && entrance) {
      // Straight up to the door, and from just inside it.
      const inside = {
        x: entrance.door.x + entrance.inward.x * APPROACH,
        y: entrance.door.y,
        z: entrance.door.z + entrance.inward.z * APPROACH,
      };
      const rest = routeBetween(plan, inside, stop.view.from) ?? [inside, stop.view.from];
      return [entrance.landing, entrance.door, ...rest];
    }
    const before = stops[i - 1]?.view.from;
    if (!before) return [stop.view.from];
    return routeBetween(plan, before, stop.view.from) ?? stop.path;
  });
  ways.set(plan, worked);
  return worked;
}
