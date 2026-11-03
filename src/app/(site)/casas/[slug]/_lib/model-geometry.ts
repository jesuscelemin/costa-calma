import {
  floorGeometry,
  houseBounds,
  stairEntry,
  type OpeningGeometry,
  type Point,
  type WallKind,
  type WallSegment,
} from "@/features/houses/plan";
import type { HousePlan, PlanFloor, Rect, Room, Side } from "@/features/houses/schema";

// The house model's architecture as boxes in metres (ADR 0006), from the plan module's geometry:
// what the scene merges into a few meshes per floor. Each floor stands at its own level: its slab
// below y = 0, its walls from 0 up. Axes as in the plan, with y up.

/** A box by its lowest corner and its size: x east, y up, z south. */
export type Box = { x: number; y: number; z: number; w: number; h: number; d: number };

/** A line on the ground, for the ink plan. */
export type InkLine = { x1: number; z1: number; x2: number; z2: number };

/** From one floor's finished floor to the next: +0,00, +3,20, +6,40. The corte reads it too. */
export const STOREY_HEIGHT = 3.2;
export const SLAB_DEPTH = 0.3;
/** Walls stand from their floor up to the slab above. */
export const WALL_HEIGHT = STOREY_HEIGHT - SLAB_DEPTH;
const DOOR_HEAD = 2.1;
const SLIDING_HEAD = 2.4;
const WINDOW_HEAD = 2.2;
export const RAILING_HEIGHT = 1.1;
const PANE = 0.03;
/** How deep the land is drawn, and how deep the pool's hollow goes into it. */
export const LAND_DEPTH = 1.6;
export const POOL_DEPTH = 1.4;
export const POOL_RIM = 0.15;
/** How far under the pool's edge its water stands. */
export const WATER_BELOW_EDGE = 0.12;

export const WALL_THICKNESS: Record<WallKind, number> = {
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
  const t = WALL_THICKNESS[wall.kind];
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
  kind === "door" || kind === "passage" ? WALL_THICKNESS.interior : WALL_THICKNESS.exterior;

/** How high an opening's gap goes: its head, the underside of the lintel over it. */
export function openingHead({ kind, sill }: Pick<OpeningGeometry, "kind" | "sill">) {
  if (kind === "window") return Math.max(WINDOW_HEAD, (sill ?? 0) + 0.5);
  return kind === "sliding" ? SLIDING_HEAD : DOOR_HEAD;
}

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

/** A door leaf, closed across its gap from its hinge, and the way it swings open to. */
export type EntranceLeaf = {
  hinge: Point;
  /** Its free end, closed and open a quarter turn. */
  closed: Point;
  open: Point;
  height: number;
  thickness: number;
};

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
  /** The front door's leaf, on its own, for the scene to swing it open: where it hangs. */
  entrance?: EntranceLeaf;
  /** Lids over enclosed rooms that no floor above covers (a roof's stair head). */
  lids: Box[];
  /** Eaves and pergolas, at the top of the floor. */
  canopies: Box[];
  /** The flights and landing of its stair, up to the floor above. */
  stair: Box[];
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

/** Steps up each flight of a stair: 18 risers of 17,8 cm from one floor to the next. */
const STEPS_PER_FLIGHT = 9;
/** How deep the landing at the far end of a U stair is, and how thick its treads and landing are. */
const LANDING = 1;
const TREAD = 0.22;

/**
 * A U stair in its well, from its floor to the next: the first flight up one half of the well from
 * the end it is entered from, the landing across the far end, and the second flight back down the
 * other half to arrive at the same end, a storey up.
 */
function stairFlights(well: Rect, entry: Side): Box[] {
  const alongZ = well.d >= well.w;
  const length = alongZ ? well.d : well.w;
  const width = (alongZ ? well.w : well.d) / 2;
  // From the entry end: 0 there, `length` at the far end.
  const fromEntry = entry === "north" || entry === "west";
  const going = (length - LANDING) / STEPS_PER_FLIGHT;
  const rise = STOREY_HEIGHT / (STEPS_PER_FLIGHT * 2);
  /** A box given along the well from its entry end, across it from its first side, and up. */
  const box = (a: number, da: number, c: number, dc: number, y: number, h: number): Box => {
    const along = fromEntry ? a : length - a - da;
    return alongZ
      ? { x: well.x + c, z: well.z + along, w: dc, d: da, y, h }
      : { x: well.x + along, z: well.z + c, w: da, d: dc, y, h };
  };
  const steps = Array.from({ length: STEPS_PER_FLIGHT }, (_, i) => i);
  const half = STOREY_HEIGHT / 2;
  return [
    // The first flight stands on the floor, solid.
    ...steps.map((i) => box(i * going, going, 0, width, 0, rise * (i + 1))),
    box(length - LANDING, LANDING, 0, width * 2, half - TREAD, TREAD),
    // The second flight, treads in the air, back towards the entry end.
    ...steps.map((i) =>
      box(
        length - LANDING - (i + 1) * going,
        going,
        width,
        width,
        half + rise * (i + 1) - TREAD,
        TREAD,
      ),
    ),
  ];
}

const sameRect = (a: Rect, b: Rect) =>
  same(a.x, b.x) && same(a.z, b.z) && same(a.w, b.w) && same(a.d, b.d);
const stairOf = (floor: PlanFloor | undefined) => floor?.rooms.find(({ kind }) => kind === "stair");

/**
 * A floor of the plan as boxes, with the floors above and below it: what covers it, and whether
 * its stair arrives from below, through a well its slab leaves open.
 */
export function floorModel(
  plan: Pick<HousePlan, "plot" | "partyWall">,
  floor: PlanFloor,
  { next, below }: { next?: PlanFloor; below?: PlanFloor },
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
  let entrance: EntranceLeaf | undefined;
  for (const wall of geometry.walls.filter(({ kind }) => kind === "railing")) {
    glass.push(along(wall, PANE, 0.05, RAILING_HEIGHT - 0.05));
    joinery.push(along(wall, 0.06, RAILING_HEIGHT - 0.05, 0.05));
  }
  for (const opening of openings) {
    const t = openingThickness(opening);
    const head = openingHead(opening);
    heads.push(along(opening, t, head, WALL_HEIGHT - head));
    if (opening.kind === "window") {
      const sill = opening.sill ?? 0;
      if (sill > 0) walls.push(along(opening, t, 0, sill));
      glass.push(along(opening, PANE, sill, head - sill));
    }
    if (opening.kind === "sliding") glass.push(along(opening, PANE, 0, head));
    if (opening.swing && opening.kind === "entrance") {
      const { hinge, leaf } = opening.swing;
      const free =
        same(hinge.x, opening.x1) && same(hinge.z, opening.z1)
          ? { x: opening.x2, z: opening.z2 }
          : { x: opening.x1, z: opening.z1 };
      entrance = { hinge, closed: free, open: leaf, height: head - 0.02, thickness: 0.06 };
    } else if (opening.swing) {
      const { hinge, leaf } = opening.swing;
      joinery.push(
        along({ x1: hinge.x, z1: hinge.z, x2: leaf.x, z2: leaf.z }, 0.04, 0, head - 0.02),
      );
    }
  }

  const stair = stairOf(floor);
  const fromBelow = stairOf(below);
  const well = stair && fromBelow && sameRect(stair, fromBelow) ? stair : undefined;
  const slabs = rooms
    .filter((room) => room.kind !== "void" && room !== well)
    .map((room) => flat(room, -SLAB_DEPTH, SLAB_DEPTH));
  const up = stairOf(next);
  const entry = stairEntry(floor);
  const flights = stair && up && sameRect(stair, up) && entry ? stairFlights(stair, entry) : [];
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

  return {
    slabs,
    walls,
    heads,
    glass,
    joinery,
    ...(entrance && { entrance }),
    lids,
    canopies,
    stair: flights,
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
    water: flat(grow(poolRoom, -POOL_RIM), -POOL_DEPTH, POOL_DEPTH - WATER_BELOW_EDGE),
  };

  // The way up to the front door: from its gap out to the plot's edge, 2 m to either side.
  const ground = plan.floors.find(({ kind }) => kind !== "plot");
  const door =
    ground && floorGeometry(ground, plan).openings.find(({ kind }) => kind === "entrance");
  const bounds = houseBounds(plan);
  let approach: Rect | undefined;
  if (door) {
    const across = same(door.z1, door.z2);
    const [a, b] = across ? [door.x1, door.x2] : [door.z1, door.z2];
    const line = across ? door.z1 : door.x1;
    const middle = across ? bounds.z + bounds.d / 2 : bounds.x + bounds.w / 2;
    const [edgeFrom, edgeTo] = across
      ? [plan.plot.z, plan.plot.z + plan.plot.d]
      : [plan.plot.x, plan.plot.x + plan.plot.w];
    const [from, to] = line < middle ? [edgeFrom, line] : [line, edgeTo];
    const side = { from: Math.min(a, b) - 2, to: Math.max(a, b) + 2 };
    approach = across
      ? { x: side.from, z: from, w: side.to - side.from, d: to - from }
      : { x: from, z: side.from, w: to - from, d: side.to - side.from };
  }

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
    .filter((_, index) => index % 2 === 0)
    // And none in the way from the plot's edge to the front door.
    .filter((point) => !approach || !inside(point, approach));

  return {
    land,
    pool,
    decks: rooms
      .filter(({ kind }) => kind === "deck" || kind === "patio")
      .map((room) => flat(room, 0, 0.06)),
    pines,
  };
}
