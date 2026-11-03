import {
  floorGeometry,
  houseBounds,
  type OpeningGeometry,
  type Point,
  type WallKind,
  type WallSegment,
} from "@/features/houses/plan";
import type { HousePlan, PlanFloor, Rect, Room } from "@/features/houses/schema";

// The house model's architecture as boxes in metres (ADR 0006), from the plan module's geometry:
// what the scene merges into a few meshes per floor. Each floor stands at its own level: its slab
// below y = 0, its walls from 0 up. Axes as in the plan, with y up.

/** A box by its lowest corner and its size: x east, y up, z south. */
export type Box = { x: number; y: number; z: number; w: number; h: number; d: number };

/** A line on the ground, for the ink plan. */
export type InkLine = { x1: number; z1: number; x2: number; z2: number };

export const WALL_HEIGHT = 2.7;
export const SLAB_DEPTH = 0.3;
const DOOR_HEAD = 2.1;
const SLIDING_HEAD = 2.4;
const WINDOW_HEAD = 2.2;
const RAILING_HEIGHT = 1.1;
const PANE = 0.03;
/** How deep the land is drawn, and how deep the pool's hollow goes into it. */
export const LAND_DEPTH = 1.6;
const POOL_DEPTH = 1.4;
const POOL_RIM = 0.15;

const thickness: Record<WallKind, number> = {
  exterior: 0.24,
  party: 0.3,
  interior: 0.1,
  railing: 0.04,
};

const EPS = 1e-6;
const same = (a: number, b: number) => Math.abs(a - b) < EPS;

/** A horizontal box along a line on the ground, `t` thick, from `y` to `y + h`. */
function along({ x1, z1, x2, z2 }: InkLine, t: number, y: number, h: number, ends = [0, 0]): Box {
  const [before, after] = ends as [number, number];
  if (same(z1, z2)) {
    const [a, b] = x1 < x2 ? [x1, x2] : [x2, x1];
    return { x: a - before, y, z: z1 - t / 2, w: b - a + before + after, h, d: t };
  }
  const [a, b] = z1 < z2 ? [z1, z2] : [z2, z1];
  return { x: x1 - t / 2, y, z: a - before, w: t, h, d: b - a + before + after };
}

const isGapEnd = (point: Point, openings: OpeningGeometry[]) =>
  openings.some(
    (o) =>
      (same(o.x1, point.x) && same(o.z1, point.z)) || (same(o.x2, point.x) && same(o.z2, point.z)),
  );

/** Walls run on past their ends by half a thickness to close corners, but never into a gap. */
function wallBox(wall: WallSegment, openings: OpeningGeometry[]): Box {
  const t = thickness[wall.kind];
  const [first, second] = same(wall.z1, wall.z2)
    ? wall.x1 < wall.x2
      ? [1, 2]
      : [2, 1]
    : wall.z1 < wall.z2
      ? [1, 2]
      : [2, 1];
  const end = (n: number) =>
    isGapEnd(n === 1 ? { x: wall.x1, z: wall.z1 } : { x: wall.x2, z: wall.z2 }, openings)
      ? 0
      : t / 2;
  return along(wall, t, 0, WALL_HEIGHT, [end(first!), end(second!)]);
}

/** The thickness of the wall an opening sits in: an outer wall unless it joins two rooms. */
const openingThickness = ({ kind }: OpeningGeometry) =>
  kind === "door" || kind === "passage" ? thickness.interior : thickness.exterior;

/** Rectangles left of `rect` once `cuts` are taken out of it. */
export function subtract(rect: Rect, cuts: readonly Rect[]): Rect[] {
  let pieces = [rect];
  for (const cut of cuts) {
    pieces = pieces.flatMap((piece) => {
      const x1 = Math.max(piece.x, cut.x);
      const x2 = Math.min(piece.x + piece.w, cut.x + cut.w);
      const z1 = Math.max(piece.z, cut.z);
      const z2 = Math.min(piece.z + piece.d, cut.z + cut.d);
      if (x2 - x1 < EPS || z2 - z1 < EPS) return [piece];
      const right = piece.x + piece.w;
      const bottom = piece.z + piece.d;
      return [
        { x: piece.x, z: piece.z, w: piece.w, d: z1 - piece.z },
        { x: piece.x, z: z2, w: piece.w, d: bottom - z2 },
        { x: piece.x, z: z1, w: x1 - piece.x, d: z2 - z1 },
        { x: x2, z: z1, w: right - x2, d: z2 - z1 },
      ].filter(({ w, d }) => w > EPS && d > EPS);
    });
  }
  return pieces;
}

const flat = (rect: Rect, y: number, h: number): Box => ({ ...rect, y, h });

/** A door's leaf and the quarter circle it sweeps, as points on the ground. */
function swingLines({ swing, x1, z1, x2, z2 }: OpeningGeometry): Point[][] {
  if (!swing) return [];
  const { hinge, leaf, clockwise } = swing;
  const free = same(hinge.x, x1) && same(hinge.z, z1) ? { x: x2, z: z2 } : { x: x1, z: z1 };
  const radius = Math.hypot(leaf.x - hinge.x, leaf.z - hinge.z);
  const from = Math.atan2(leaf.z - hinge.z, leaf.x - hinge.x);
  let to = Math.atan2(free.z - hinge.z, free.x - hinge.x);
  // The arc turns a quarter, clockwise as x turns towards z: the angle grows.
  if (clockwise && to < from) to += Math.PI * 2;
  if (!clockwise && to > from) to -= Math.PI * 2;
  const arc = Array.from({ length: 13 }, (_, i) => {
    const angle = from + ((to - from) * i) / 12;
    return { x: hinge.x + Math.cos(angle) * radius, z: hinge.z + Math.sin(angle) * radius };
  });
  return [[hinge, leaf], arc];
}

export type FloorModel = {
  /** What the floor stands on: its rooms' slabs (a double height has none). */
  slabs: Box[];
  /** Walls with their openings, and the sills under their windows. */
  walls: Box[];
  /** Lintels over the openings: what a cut at half height takes away. */
  heads: Box[];
  /** Window and sliding panes, and glass railings. */
  glass: Box[];
  /** Door leaves, open a quarter turn, and the rails on top of railings. */
  joinery: Box[];
  /** Lids over enclosed rooms that no floor above covers (a roof's stair head). */
  lids: Box[];
  /** Eaves and pergolas, at the top of the floor. */
  canopies: Box[];
  /** Ceiling lights of its enclosed rooms. */
  lights: Box[];
  /** The middle of its enclosed rooms, where its lamp hangs. */
  lamp: Point | undefined;
  /** The plan in ink: walls, windows and the doors' swings, on the ground. */
  ink: { walls: InkLine[]; windows: InkLine[]; swings: Point[][] };
  /** Open-air surfaces with a finish of their own: decks, planters, patios. */
  decks: Box[];
  planters: Box[];
};

/** The plot as a base: the land around the pool's hollow, the pool, the pines. */
export type PlotModel = {
  land: Box[];
  /** The pool's basin floor, its water's full extent, and the paved surfaces on the land. */
  pool: { basin: Box; walls: Box[]; water: Box } | undefined;
  decks: Box[];
  /** Pine trunks' feet, clear of the house, the porch and the pool. */
  pines: Point[];
};

const enclosed = (room: Room) => !room.open && room.kind !== "void";

function pergolaSlats(canopy: Rect): Box[] {
  const posts = [
    [canopy.x, canopy.z],
    [canopy.x + canopy.w - 0.12, canopy.z],
    [canopy.x, canopy.z + canopy.d - 0.12],
    [canopy.x + canopy.w - 0.12, canopy.z + canopy.d - 0.12],
  ].map(([x, z]) => ({ x: x!, y: 0, z: z!, w: 0.12, h: 2.5, d: 0.12 }));
  const count = Math.max(2, Math.round(canopy.w / 0.5));
  const slats = Array.from({ length: count }, (_, i) => ({
    x: canopy.x + ((canopy.w - 0.08) * i) / (count - 1),
    y: 2.5,
    z: canopy.z,
    w: 0.08,
    h: 0.16,
    d: canopy.d,
  }));
  return [...posts, ...slats];
}

/** A floor of the plan as boxes and ink lines, and the floor above it to know what it covers. */
export function floorModel(
  plan: Pick<HousePlan, "plot" | "partyWall">,
  floor: PlanFloor,
  next: PlanFloor | undefined,
): FloorModel {
  const geometry = floorGeometry(floor, plan);
  const { openings } = geometry;
  const rooms = floor.rooms;
  // A double height above is open to the floor over it, which covers it: no lid under it either.
  const above = next?.rooms ?? [];

  const walls = geometry.walls
    .filter(({ kind }) => kind !== "railing")
    .map((wall) => wallBox(wall, openings));
  const heads: Box[] = [];
  const glass: Box[] = [];
  const joinery: Box[] = [];
  for (const wall of geometry.walls.filter(({ kind }) => kind === "railing")) {
    glass.push(along(wall, PANE, 0.05, RAILING_HEIGHT - 0.05));
    joinery.push(along(wall, 0.06, RAILING_HEIGHT - 0.05, 0.05));
  }
  for (const opening of openings) {
    const t = openingThickness(opening);
    const head =
      opening.kind === "window"
        ? Math.max(WINDOW_HEAD, (opening.sill ?? 0) + 0.5)
        : opening.kind === "sliding"
          ? SLIDING_HEAD
          : DOOR_HEAD;
    heads.push(along(opening, t, head, WALL_HEIGHT - head));
    if (opening.kind === "window") {
      const sill = opening.sill ?? 0;
      if (sill > 0) walls.push(along(opening, t, 0, sill));
      glass.push(along(opening, PANE, sill, head - sill));
    }
    if (opening.kind === "sliding") glass.push(along(opening, PANE, 0, head));
    if (opening.swing) {
      const { hinge, leaf } = opening.swing;
      joinery.push(
        along({ x1: hinge.x, z1: hinge.z, x2: leaf.x, z2: leaf.z }, 0.04, 0, head - 0.02),
      );
    }
  }

  const slabs = rooms
    .filter((room) => room.kind !== "void")
    .map((room) => flat(room, -SLAB_DEPTH, SLAB_DEPTH));
  const lids = rooms
    .filter(enclosed)
    .flatMap((room) => subtract(room, above))
    .map((rect) => flat(rect, WALL_HEIGHT, 0.2));
  const covered = (rect: Rect) => subtract(rect, above).length === 0;
  const canopies = (floor.canopies ?? []).flatMap((canopy) =>
    canopy.kind === "pergola"
      ? pergolaSlats(canopy)
      : covered(canopy)
        ? []
        : [flat(canopy, WALL_HEIGHT, 0.2)],
  );

  const lit = rooms.filter(enclosed).filter((room) => room.kind !== "stair");
  const lights = lit.map((room) => {
    const size = Math.min(0.8, room.w * 0.4, room.d * 0.4);
    return {
      x: room.x + (room.w - size) / 2,
      y: WALL_HEIGHT - 0.04,
      z: room.z + (room.d - size) / 2,
      w: size,
      h: 0.03,
      d: size,
    };
  });
  const area = lit.reduce((sum, room) => sum + room.w * room.d, 0);
  const lamp = area
    ? {
        x: lit.reduce((sum, room) => sum + (room.x + room.w / 2) * room.w * room.d, 0) / area,
        z: lit.reduce((sum, room) => sum + (room.z + room.d / 2) * room.w * room.d, 0) / area,
      }
    : undefined;

  const line = ({ x1, z1, x2, z2 }: InkLine): InkLine => ({ x1, z1, x2, z2 });
  return {
    slabs,
    walls,
    heads,
    glass,
    joinery,
    lids,
    canopies,
    lights,
    lamp,
    ink: {
      walls: geometry.walls.map(line),
      windows: openings.filter(({ kind }) => kind === "window" || kind === "sliding").map(line),
      swings: openings.flatMap(swingLines),
    },
    decks: rooms
      .filter(
        (room) =>
          room.open &&
          (room.kind === "deck" ||
            room.kind === "terrace" ||
            room.kind === "solarium" ||
            room.kind === "lounge"),
      )
      .map((room) => flat(room, 0, 0.04)),
    planters: rooms.filter((room) => room.kind === "planter").map((room) => flat(room, 0, 0.35)),
  };
}

const grow = (rect: Rect, by: number): Rect => ({
  x: rect.x - by,
  z: rect.z - by,
  w: rect.w + by * 2,
  d: rect.d + by * 2,
});
const inside = (point: Point, rect: Rect) =>
  point.x > rect.x && point.x < rect.x + rect.w && point.z > rect.z && point.z < rect.z + rect.d;

/** The plot as boxes: its land with the pool sunk into it, its paving and its pines. */
export function plotModel(plan: HousePlan): PlotModel {
  const plot = plan.floors.find(({ kind }) => kind === "plot");
  const rooms = plot?.rooms ?? [];
  const poolRoom = rooms.find(({ kind }) => kind === "pool");
  const land = subtract(plan.plot, poolRoom ? [poolRoom] : []).map((rect) =>
    flat(rect, -LAND_DEPTH, LAND_DEPTH),
  );
  const pool = poolRoom && {
    basin: flat(poolRoom, -LAND_DEPTH, LAND_DEPTH - POOL_DEPTH),
    // Its sides, which close it where it reaches the plot's edge.
    walls: [
      { ...poolRoom, d: POOL_RIM },
      { ...poolRoom, z: poolRoom.z + poolRoom.d - POOL_RIM, d: POOL_RIM },
      { ...poolRoom, w: POOL_RIM },
      { ...poolRoom, x: poolRoom.x + poolRoom.w - POOL_RIM, w: POOL_RIM },
    ].map((rect) => flat(rect, -LAND_DEPTH, LAND_DEPTH)),
    water: flat(grow(poolRoom, -POOL_RIM), -POOL_DEPTH, POOL_DEPTH - 0.12),
  };

  // Pines along the plot's edge, every 3 m, kept 1.5 m clear of everything built.
  const house = grow(houseBounds(plan), 1.5);
  const built = rooms.filter(({ kind }) => kind !== "garden").map((room) => grow(room, 1));
  const { x, z, w, d } = plan.plot;
  const inset = 1.2;
  const candidates: Point[] = [];
  for (let along = inset; along <= w - inset + EPS; along += 3) {
    candidates.push({ x: x + along, z: z + inset }, { x: x + along, z: z + d - inset });
  }
  for (let down = inset + 3; down <= d - inset - 3 + EPS; down += 3) {
    candidates.push({ x: x + inset, z: z + down }, { x: x + w - inset, z: z + down });
  }
  const pines = candidates
    .filter((point) => !inside(point, house) && !built.some((rect) => inside(point, rect)))
    // Not a hedge: every other one.
    .filter((_, index) => index % 2 === 0);

  return {
    land,
    pool,
    decks: rooms
      .filter(({ kind }) => kind === "deck" || kind === "patio")
      .map((room) => flat(room, 0, 0.06)),
    pines,
  };
}
