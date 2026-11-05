import { footprint, furniturePieces } from "@/features/houses/furniture";
import {
  floorGeometry,
  houseBounds,
  planFigures,
  type OpeningGeometry,
} from "@/features/houses/plan";
import type { Furniture, HousePlan, PlanFloor, Rect, Room, Side } from "@/features/houses/schema";
import { formatArea } from "@/lib/format";

import { plotModel, WALL_HEIGHT } from "./model-geometry";
import { builtFloors } from "./tour";

// The sheet as an architect draws it on paper (ADR 0010): for each storey, its rooms' names, m²
// and sizes, its doors' swings and its windows, and its furniture drawn in plan; for the ground
// floor, also the grid of axes with their bubbles, the chains of dimensions, the plot's line, the
// way up to the door, the pool, the trees, the title block with its scale and the north. Pure,
// from the plan, in the sheet's own metres: `u` to the right and `v` down as the screen shows it
// from above, with the way in at the top. The walls are not drawn: they are the model, cut.

/** A point on the sheet, in metres: right and down as seen from above. */
export type SheetPoint = { u: number; v: number };

/** How heavy a line is drawn: a hairline, fine, thin or medium, in metres on the sheet. */
export type Weight = "hair" | "fine" | "thin" | "medium";
export const WEIGHTS: Record<Weight, number> = {
  hair: 0.012,
  fine: 0.02,
  thin: 0.03,
  medium: 0.05,
};

export type SheetMark =
  | { kind: "line"; from: SheetPoint; to: SheetPoint; weight: Weight; dash?: readonly number[] }
  | {
      kind: "shape";
      points: SheetPoint[];
      weight: Weight;
      closed: boolean;
      /** Filled with the paper, to hide what is under it, or with the ink. */
      fill?: "paper" | "ink";
      dash?: readonly number[];
      /** A piece of furniture's, standing in the model too. */
      solid?: Solid;
      /** Only in the model: not drawn on the sheet. */
      ghost?: boolean;
      /** A loose piece, which furniture placed by hand takes the place of. */
      loose?: boolean;
    }
  | {
      kind: "circle";
      centre: SheetPoint;
      radius: number;
      weight: Weight;
      fill?: "paper" | "ink";
      dash?: readonly number[];
      solid?: Solid;
      loose?: boolean;
    }
  | { kind: "arc"; centre: SheetPoint; radius: number; from: number; to: number; weight: Weight }
  | {
      kind: "text";
      at: SheetPoint;
      text: string;
      /** Its letters' height, in metres. */
      size: number;
      weight: 400 | 600 | 700;
      align: "left" | "center" | "right";
      /** Space between letters, as a share of the size. */
      tracking?: number;
      /** A quarter turn anticlockwise, for a chain of dimensions up the side. */
      upright?: boolean;
    };

/** What furniture is made of in the model. */
export type FurnitureMaterial =
  "oak" | "lime" | "lacquer" | "stone" | "fabric" | "frame" | "quartz" | "steel";

/** A piece of furniture as it stands in the model: from a height, so tall, in a material. */
export type Solid = { y: number; h: number; material: FurnitureMaterial };

/** A piece of furniture in the world: a box over its rectangle, or a cylinder within it. */
export type FurnitureSolid = Solid & Rect & { round: boolean };

export type SheetDrawing = {
  /** What the sheet covers, in its own metres. */
  bounds: { u0: number; v0: number; u1: number; v1: number };
  marks: SheetMark[];
};

/** The sheet's metres from the world's: seen from above with the south at the top. */
const toSheet = (x: number, z: number): SheetPoint => ({ u: -x, v: -z });
const rectOnSheet = ({ x, z, w, d }: Rect): SheetPoint[] => [
  toSheet(x, z),
  toSheet(x + w, z),
  toSheet(x + w, z + d),
  toSheet(x, z + d),
];

const two = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** «5,60». */
export const dimension = (metres: number) => two.format(metres);

const EPS = 1e-6;

// ---- Furniture ---------------------------------------------------------------------------------

/** A rectangle in a room, given from one of its walls: along it from its start, and out from it. */
function fromWall(
  room: Rect,
  side: Side,
  along: number,
  out: number,
  length: number,
  depth: number,
): Rect {
  switch (side) {
    case "north":
      return { x: room.x + along, z: room.z + out, w: length, d: depth };
    case "south":
      return { x: room.x + along, z: room.z + room.d - out - depth, w: length, d: depth };
    case "west":
      return { x: room.x + out, z: room.z + along, w: depth, d: length };
    case "east":
      return { x: room.x + room.w - out - depth, z: room.z + along, w: depth, d: length };
  }
}

const sideLength = (room: Rect, side: Side) =>
  side === "north" || side === "south" ? room.w : room.d;
const across = (room: Rect, side: Side) => (side === "north" || side === "south" ? room.d : room.w);

/** Which of a room's sides an opening is on, if it is on one. */
function sideOf(room: Room, gap: OpeningGeometry): Side | undefined {
  if (Math.abs(gap.z1 - gap.z2) < EPS) {
    if (Math.abs(gap.z1 - room.z) < EPS) return "north";
    if (Math.abs(gap.z1 - (room.z + room.d)) < EPS) return "south";
  } else {
    if (Math.abs(gap.x1 - room.x) < EPS) return "west";
    if (Math.abs(gap.x1 - (room.x + room.w)) < EPS) return "east";
  }
  return undefined;
}

const SIDES: Side[] = ["north", "south", "west", "east"];

/** Whether an opening lies along one of a room's sides. */
const within = (room: Room, gap: OpeningGeometry) =>
  Math.min(gap.x1, gap.x2) >= room.x - EPS &&
  Math.max(gap.x1, gap.x2) <= room.x + room.w + EPS &&
  Math.min(gap.z1, gap.z2) >= room.z - EPS &&
  Math.max(gap.z1, gap.z2) <= room.z + room.d + EPS;

/**
 * The room's walls furniture stands against, the longest first: those with nothing in them, then
 * those with only windows high enough to stand a worktop or a bed under. A wall with a door or a
 * sliding door is never one: what stood there would block it.
 */
function solidSides(room: Room, openings: OpeningGeometry[]) {
  const mine = openings.filter((gap) => within(room, gap));
  const used = new Set(mine.map((gap) => sideOf(room, gap)));
  const blocked = new Set(
    mine
      .filter((gap) => gap.kind !== "window" || (gap.sill ?? 0) < HIGH_SILL)
      .map((gap) => sideOf(room, gap)),
  );
  const rank = (sides: Side[]) =>
    [...sides].sort((a, b) => sideLength(room, b) - sideLength(room, a));
  const free = [
    ...rank(SIDES.filter((side) => !used.has(side))),
    ...rank(SIDES.filter((side) => used.has(side) && !blocked.has(side))),
  ];
  return { free, all: rank(SIDES) };
}

/** A window this high off the floor, or higher, leaves room for a worktop under it. */
const HIGH_SILL = 0.85;

const opposite: Record<Side, Side> = { north: "south", south: "north", west: "east", east: "west" };

/** A room's furniture as its plan draws it, and the wall it stands against. */
type Furnishing = { marks: SheetMark[]; against?: Side };

const box = (
  rect: Rect,
  weight: Weight = "thin",
  fill: "paper" | "ink" | undefined = "paper",
  solid?: Solid,
): SheetMark => ({
  kind: "shape",
  points: rectOnSheet(rect),
  closed: true,
  weight,
  ...(fill && { fill }),
  ...(solid && { solid }),
});
const circle = (
  x: number,
  z: number,
  radius: number,
  weight: Weight = "fine",
  solid?: Solid,
): SheetMark => ({
  kind: "circle",
  centre: toSheet(x, z),
  radius,
  weight,
  fill: "paper",
  ...(solid && { solid }),
});
/** A piece's volume: from a height, so tall, in a material. */
const at = (y: number, h: number, material: FurnitureMaterial): Solid => ({ y, h, material });
/**
 * A part the plan does not draw, only the model has: a mattress, a table's legs; or, dashed, what
 * stands over the cut, such as wall units.
 */
const hidden = (rect: Rect, solid: Solid, dashed = false): SheetMark => ({
  kind: "shape",
  points: rectOnSheet(rect),
  closed: true,
  weight: "hair",
  solid,
  ...(dashed ? { dash: [0.1, 0.07] } : { ghost: true }),
});
const line = (
  x1: number,
  z1: number,
  x2: number,
  z2: number,
  weight: Weight = "fine",
): SheetMark => ({
  kind: "line",
  from: toSheet(x1, z1),
  to: toSheet(x2, z2),
  weight,
});
const middleOf = ({ x, z, w, d }: Rect) => ({ x: x + w / 2, z: z + d / 2 });
/** A loose piece: an armchair, a low table, a bedside table, a lounger. */
const loose = (mark: SheetMark): SheetMark =>
  mark.kind === "shape" || mark.kind === "circle" ? { ...mark, loose: true } : mark;

/** Fitted joinery stops this short of the ceiling. */
const UNDER_CEILING = 0.03;
/** The gap between two doors of fitted joinery: no handles, only the shadow between them. */
const JOINT = 0.004;
/** How wide a door of fitted joinery is, at most. */
const DOOR = 0.6;

/**
 * Fitted joinery along a wall, lacquered white and handleless (ADR 0011): its doors, each a box a
 * joint apart, from `y` up, so tall. Only the model has them; the plan draws the run whole.
 */
function doors(
  room: Room,
  side: Side,
  along: number,
  out: number,
  length: number,
  depth: number,
  y: number,
  h: number,
): SheetMark[] {
  const count = Math.max(1, Math.round(length / DOOR));
  const each = length / count;
  return Array.from({ length: count }, (_, i) =>
    hidden(
      fromWall(room, side, along + i * each + JOINT / 2, out, each - JOINT, depth),
      at(y, h, "lacquer"),
    ),
  );
}

/** A built-in wardrobe: lacquered doors from the floor to just under the ceiling. */
function fittedWardrobe(w: Rect): SheetMark[] {
  const alongX = w.w >= w.d;
  const length = alongX ? w.w : w.d;
  const count = Math.max(1, Math.round(length / DOOR));
  const each = length / count;
  const h = WALL_HEIGHT - UNDER_CEILING;
  return [
    box(w),
    line(w.x, w.z, w.x + w.w, w.z + w.d, "hair"),
    line(w.x + w.w, w.z, w.x, w.z + w.d, "hair"),
    ...Array.from({ length: count }, (_, i) =>
      hidden(
        alongX
          ? { x: w.x + i * each + JOINT / 2, z: w.z, w: each - JOINT, d: w.d }
          : { x: w.x, z: w.z + i * each + JOINT / 2, w: w.w, d: each - JOINT },
        at(0, h, "lacquer"),
      ),
    ),
  ];
}

/** A bed against a wall: its frame, its pillows and its turned-down sheet, and its bedside tables. */
function bed(room: Room, side: Side): SheetMark[] {
  const double = sideLength(room, side) >= 2.8;
  const width = double ? 1.6 : 0.9;
  const length = Math.min(2, across(room, side) - 0.8);
  const start = (sideLength(room, side) - width) / 2;
  const frame = fromWall(room, side, start, 0, width, length);
  const marks: SheetMark[] = [
    box(frame, "thin", "paper", at(0, 0.3, "oak")),
    hidden(fromWall(room, side, start, 0.08, width, length - 0.12), at(0.3, 0.22, "fabric")),
    hidden(fromWall(room, side, start - 0.1, 0, width + 0.2, 0.08), at(0, 1.05, "oak")),
  ];
  const pillows = double ? 2 : 1;
  const pw = (width - 0.15 * (pillows + 1)) / pillows;
  for (let i = 0; i < pillows; i++) {
    marks.push(
      box(
        fromWall(room, side, start + 0.15 + i * (pw + 0.15), 0.1, pw, 0.4),
        "fine",
        "paper",
        at(0.52, 0.12, "fabric"),
      ),
    );
  }
  const fold = fromWall(room, side, start, 0.7, width, 0.0001);
  marks.push(
    line(
      fold.x,
      fold.z,
      fold.x + (fold.w > 0.01 ? fold.w : 0),
      fold.z + (fold.d > 0.01 ? fold.d : 0),
    ),
  );
  if (sideLength(room, side) >= width + 1.1) {
    for (const where of [start - 0.5, start + width + 0.05]) {
      marks.push(
        loose(
          box(fromWall(room, side, where, 0.05, 0.45, 0.4), "fine", "paper", at(0, 0.5, "oak")),
        ),
      );
    }
  }
  return marks;
}

/** A sofa against a wall, with its coffee table, two armchairs across, and a rug under them all. */
function lounge(room: Room, side: Side): SheetMark[] {
  const length = Math.min(2.6, sideLength(room, side) - 1);
  const start = (sideLength(room, side) - length) / 2;
  const depth = across(room, side);
  const sofa = fromWall(room, side, start, 0.1, length, 0.9);
  const back = fromWall(room, side, start, 0.1, length, 0.22);
  const table = fromWall(room, side, start + length / 2 - 0.6, 1.4, 1.2, 0.6);
  const rug = fromWall(room, side, start - 0.3, 0.6, length + 0.6, Math.min(2.6, depth - 1.2));
  const marks: SheetMark[] = [
    { ...box(rug, "hair", undefined, at(0, 0.015, "fabric")), dash: [0.12, 0.08] } as SheetMark,
    box(sofa, "thin", "paper", at(0, 0.42, "fabric")),
    box(back, "fine", "paper", at(0.42, 0.4, "fabric")),
    loose(box(table, "fine", "paper", at(0, 0.38, "oak"))),
  ];
  if (depth > 3.6) {
    for (const where of [start + 0.1, start + length - 0.9]) {
      marks.push(
        loose(
          box(
            fromWall(room, side, where, Math.min(depth - 1.1, 2.6), 0.8, 0.8),
            "fine",
            "paper",
            at(0, 0.45, "fabric"),
          ),
        ),
      );
    }
  }
  return marks;
}

/** A dining table down the room's length, towards its north or west end, with its chairs. */
function dining(room: Room): SheetMark[] {
  const long = room.d >= room.w ? "z" : "x";
  const span = long === "z" ? room.d : room.w;
  const length = Math.min(2.4, span - 1.8);
  const width = 1;
  const centre = middleOf(room);
  // Off the middle, to leave the room's name the other end.
  const shift = Math.max(0, (span - length) / 2 - 1.1);
  const { x, z } =
    long === "z" ? { x: centre.x, z: centre.z - shift } : { x: centre.x - shift, z: centre.z };
  const table: Rect =
    long === "z"
      ? { x: x - width / 2, z: z - length / 2, w: width, d: length }
      : { x: x - length / 2, z: z - width / 2, w: length, d: width };
  const inset = (by: number): Rect => ({
    x: table.x + by,
    z: table.z + by,
    w: table.w - by * 2,
    d: table.d - by * 2,
  });
  const marks: SheetMark[] = [
    box(table, "thin", "paper", at(0.71, 0.04, "oak")),
    hidden(inset(0.25), at(0, 0.71, "oak")),
  ];
  const chairs = Math.max(2, Math.floor(length / 0.65));
  for (let i = 0; i < chairs; i++) {
    const along = -length / 2 + (length / chairs) * (i + 0.5) - 0.22;
    for (const sideSign of [-1, 1]) {
      const off = sideSign * (width / 2 + 0.08) - (sideSign < 0 ? 0.42 : 0);
      const seat: Rect =
        long === "z"
          ? { x: x + off, z: z + along, w: 0.42, d: 0.44 }
          : { x: x + along, z: z + off, w: 0.44, d: 0.42 };
      // The back, on the side away from the table.
      const back: Rect =
        long === "z"
          ? { x: sideSign < 0 ? seat.x : seat.x + seat.w - 0.05, z: seat.z, w: 0.05, d: seat.d }
          : { x: seat.x, z: sideSign < 0 ? seat.z : seat.z + seat.d - 0.05, w: seat.w, d: 0.05 };
      marks.push(
        box(seat, "fine", "paper", at(0, 0.45, "oak")),
        hidden(back, at(0.45, 0.42, "oak")),
      );
    }
  }
  return marks;
}

/**
 * A kitchen: a run of base units with its worktop along its longest solid wall, its sink and its
 * hob; wall units over it; a tall unit at one end; and an island with stools if the room is deep.
 */
function kitchen(room: Room, side: Side, windowed: boolean): SheetMark[] {
  const length = sideLength(room, side) - 0.3;
  const run = fromWall(room, side, 0.15, 0, length, 0.62);
  const sink = fromWall(room, side, 0.15 + length * 0.3, 0.1, 0.7, 0.42);
  const hobArea = fromWall(room, side, 0.15 + length * 0.66, 0.06, 0.6, 0.5);
  const hob = middleOf(hobArea);
  const tall = fromWall(room, side, 0.15, 0, 0.62, 0.62);
  const base = 0.15 + 0.62;
  const marks: SheetMark[] = [
    // The base units, lacquered and handleless, over a dark plinth set back under them.
    box(run),
    ...doors(room, side, base, 0, length - 0.62, 0.6, 0.1, 0.76),
    hidden(fromWall(room, side, base, 0, length - 0.62, 0.54), at(0, 0.1, "frame")),
    // One slab of honed stone for the worktop, its sink in brushed steel.
    hidden(fromWall(room, side, 0.15, 0, length, 0.64), at(0.86, 0.04, "quartz")),
    box(sink, "fine", "paper", at(0.9, 0.004, "steel")),
    hidden(
      fromWall(room, side, 0.15 + length * 0.3 + 0.04, 0.14, 0.62, 0.34),
      at(0.9, 0.006, "frame"),
    ),
    hidden(hobArea, at(0.9, 0.006, "frame")),
    // The tall unit up to the ceiling, with its two ovens in black glass; and wall units over the
    // worktop, dashed as a plan has them, unless the worktop stands under a window.
    box(tall, "thin", "paper", at(0, WALL_HEIGHT - UNDER_CEILING, "lacquer")),
    hidden(fromWall(room, side, 0.18, 0.62, 0.56, 0.012), at(0.85, 0.58, "frame")),
    hidden(fromWall(room, side, 0.18, 0.62, 0.56, 0.012), at(1.47, 0.45, "frame")),
    // A splashback of the same stone up to the wall units, unless the worktop stands under a window.
    ...(windowed
      ? []
      : [
          hidden(fromWall(room, side, base, 0, length - 0.62, 0.012), at(0.9, 0.6, "quartz")),
          {
            kind: "shape",
            points: rectOnSheet(fromWall(room, side, 0.8, 0, length - 0.65, 0.36)),
            closed: true,
            weight: "hair",
            dash: [0.1, 0.07],
          } satisfies SheetMark,
          ...doors(room, side, 0.8, 0, length - 0.65, 0.36, 1.5, 0.75),
        ]),
  ];
  for (const [dx, dz] of [
    [-0.14, -0.12],
    [0.14, -0.12],
    [-0.14, 0.12],
    [0.14, 0.12],
  ] as const) {
    marks.push(circle(hob.x + dx, hob.z + dz, 0.08, "hair"));
  }
  if (across(room, side) >= 3) {
    const islandLength = Math.min(2.2, length - 1.2);
    const island = fromWall(
      room,
      side,
      (sideLength(room, side) - islandLength) / 2,
      1.65,
      islandLength,
      0.9,
    );
    marks.push(
      box(island, "thin", "paper", at(0, 0.86, "oak")),
      hidden(
        { x: island.x - 0.02, z: island.z - 0.02, w: island.w + 0.04, d: island.d + 0.04 },
        at(0.86, 0.04, "quartz"),
      ),
    );
    // Stools along its far side.
    const stools = Math.max(2, Math.floor(islandLength / 0.6));
    for (let i = 0; i < stools; i++) {
      const c = middleOf(
        fromWall(
          room,
          side,
          (sideLength(room, side) - islandLength) / 2 + (islandLength / stools) * (i + 0.5) - 0.18,
          2.75,
          0.36,
          0.36,
        ),
      );
      marks.push(loose(circle(c.x, c.z, 0.18, "fine", at(0, 0.66, "oak"))));
    }
  }
  return marks;
}

/** A bathroom: a bath or a shower tray, a WC and a basin, along its walls. */
function bathroom(room: Room, side: Side, shower: boolean): SheetMark[] {
  const along = sideLength(room, side);
  const marks: SheetMark[] = [];
  if (shower) {
    const tray = fromWall(room, side, 0.05, 0.05, 0.9, 0.9);
    marks.push(
      box(tray, "fine", "paper", at(0, 0.05, "stone")),
      line(tray.x, tray.z, tray.x + tray.w, tray.z + tray.d, "hair"),
    );
  } else if (along >= 1.8) {
    const bath = fromWall(room, side, 0.05, 0.05, 1.7, 0.72);
    const inner = fromWall(room, side, 0.15, 0.13, 1.5, 0.56);
    marks.push(box(bath, "thin", "paper", at(0, 0.55, "lime")), box(inner, "hair"));
  }
  const other = opposite[side];
  const wcAt = Math.max(0.1, sideLength(room, other) - 0.6);
  const wc = fromWall(room, other, wcAt, 0.02, 0.4, 0.2);
  const bowl = middleOf(fromWall(room, other, wcAt, 0.22, 0.4, 0.42));
  marks.push(
    box(wc, "fine", "paper", at(0, 0.8, "lime")),
    circle(bowl.x, bowl.z, 0.19, "fine", at(0, 0.4, "lime")),
  );
  const basin = fromWall(room, other, 0.15, 0.02, 0.6, 0.45);
  const tap = middleOf(basin);
  marks.push(box(basin, "fine", "paper", at(0.6, 0.25, "oak")), circle(tap.x, tap.z, 0.14, "hair"));
  return marks;
}

/** A desk against a wall, with its chair. */
function study(room: Room, side: Side): SheetMark[] {
  const desk = fromWall(room, side, (sideLength(room, side) - 1.4) / 2, 0.05, 1.4, 0.7);
  const seat = middleOf(fromWall(room, side, sideLength(room, side) / 2 - 0.25, 0.95, 0.5, 0.5));
  return [
    box(desk, "thin", "paper", at(0.71, 0.04, "oak")),
    hidden(
      fromWall(room, side, (sideLength(room, side) - 1.4) / 2 + 0.05, 0.1, 0.05, 0.6),
      at(0, 0.71, "oak"),
    ),
    hidden(
      fromWall(room, side, (sideLength(room, side) + 1.4) / 2 - 0.1, 0.1, 0.05, 0.6),
      at(0, 0.71, "oak"),
    ),
    circle(seat.x, seat.z, 0.24, "fine", at(0, 0.5, "fabric")),
  ];
}

/** A dressing room's rails: a run of hanging along its wall. */
function dressing(room: Room, side: Side): SheetMark[] {
  const rail = fromWall(room, side, 0.1, 0.02, sideLength(room, side) - 0.2, 0.55);
  const marks: SheetMark[] = [box(rail, "thin", "paper", at(0, 2.1, "oak"))];
  const count = Math.floor(rail.w > rail.d ? rail.w / 0.12 : rail.d / 0.12);
  for (let i = 1; i < count; i++) {
    const t = i / count;
    marks.push(
      rail.w > rail.d
        ? line(
            rail.x + rail.w * t,
            rail.z + 0.05,
            rail.x + rail.w * t - 0.08,
            rail.z + rail.d - 0.05,
            "hair",
          )
        : line(
            rail.x + 0.05,
            rail.z + rail.d * t,
            rail.x + rail.w - 0.05,
            rail.z + rail.d * t - 0.08,
            "hair",
          ),
    );
  }
  return marks;
}

/** A utility room's washer and dryer under a worktop. */
function utility(room: Room, side: Side): SheetMark[] {
  const run = fromWall(room, side, 0.1, 0, sideLength(room, side) - 0.2, 0.62);
  const marks: SheetMark[] = [box(run, "thin", "paper", at(0, 0.9, "lime"))];
  for (const where of [0.2, 0.85]) {
    const unit = fromWall(room, side, where, 0.04, 0.58, 0.55);
    const c = middleOf(unit);
    marks.push(box(unit, "fine"), circle(c.x, c.z, 0.2, "hair"));
  }
  return marks;
}

/** Loungers in a row, for a terrace or a solarium. */
function loungers(room: Room, side: Side): SheetMark[] {
  const marks: SheetMark[] = [];
  const count = Math.min(3, Math.floor((sideLength(room, side) - 0.6) / 1));
  for (let i = 0; i < count; i++) {
    const where = 0.5 + i * 1;
    marks.push(
      loose(
        box(fromWall(room, side, where, 0.4, 0.7, 1.9), "fine", "paper", at(0, 0.32, "fabric")),
      ),
      loose(
        box(fromWall(room, side, where, 0.4, 0.7, 0.5), "hair", "paper", at(0.32, 0.3, "fabric")),
      ),
    );
  }
  return marks;
}

/** How high the sheet cuts a storey: what stands from here up is over the cut, and not drawn. */
const SHEET_CUT = 1.2;

/** Lower than this, a piece placed by hand lies flat on the floor, as a rug does. */
const FLAT = 0.05;

/**
 * A piece placed by hand, as the sheet draws it: its footprint, a circle if it is round; a rug's
 * dashed, as the sheet draws what lies on the floor.
 */
function placedMark(placed: Furniture): SheetMark[] {
  const piece = furniturePieces[placed.piece];
  if (!piece || (placed.y ?? 0) >= SHEET_CUT) return [];
  const rect = footprint(placed, piece);
  const flat = piece.size.h < FLAT;
  const weight: Weight = flat || (placed.y ?? 0) > 0 ? "hair" : "fine";
  if (piece.round) {
    const { x, z } = middleOf(rect);
    return [circle(x, z, Math.min(rect.w, rect.d) / 2, weight)];
  }
  const mark = box(rect, weight);
  return [flat ? ({ ...mark, dash: [0.12, 0.08] } as SheetMark) : mark];
}

/** The rooms whose kind's furniture is fitted: a kitchen's units, a bathroom's sanitaryware. */
const FITTED = new Set<Room["kind"]>(["kitchen", "bath", "toilet", "dressing", "utility"]);

/**
 * A room's furniture, drawn in plan, against the wall it is best against. Placed by hand, its
 * pieces take the place of all its kind's loose furniture: of a kitchen's or a bathroom's only
 * what is loose, for what is fitted stays; of a bedroom's, a living room's or a terrace's, all
 * of it but its fitted wardrobe.
 */
function furnitureOf(room: Room, openings: OpeningGeometry[]): Furnishing {
  const drawn = kindFurniture(room, openings);
  if (!room.furniture) return drawn;
  const kept = FITTED.has(room.kind)
    ? drawn.marks.filter((mark) => !("loose" in mark && mark.loose))
    : room.wardrobe
      ? fittedWardrobe(room.wardrobe)
      : [];
  return { ...drawn, marks: [...kept, ...room.furniture.flatMap(placedMark)] };
}

/** What a room of its kind has, drawn from its walls. */
function kindFurniture(room: Room, openings: OpeningGeometry[]): Furnishing {
  const { free, all } = solidSides(room, openings);
  const side = free[0] ?? all[0]!;
  const marks: SheetMark[] = [];
  if (room.wardrobe) {
    marks.push(...fittedWardrobe(room.wardrobe));
  }
  switch (room.kind) {
    case "bedroom":
      return { marks: [...marks, ...bed(room, side)], against: side };
    case "living":
      return { marks: [...marks, ...lounge(room, side)], against: side };
    case "dining":
      return { marks: [...marks, ...dining(room)], against: room.d >= room.w ? "north" : "west" };
    case "kitchen": {
      const windowed = openings.some(
        (gap) => gap.kind === "window" && sideOf(room, gap) === side && within(room, gap),
      );
      return { marks: [...marks, ...kitchen(room, side, windowed)], against: side };
    }
    case "bath":
      return { marks: [...marks, ...bathroom(room, side, room.w * room.d < 4.5)], against: side };
    case "toilet":
      return { marks: [...marks, ...bathroom(room, side, true).slice(2)], against: side };
    case "study":
      return { marks: [...marks, ...study(room, side)], against: side };
    case "dressing":
      return { marks: [...marks, ...dressing(room, side)], against: side };
    case "utility":
      return { marks: [...marks, ...utility(room, side)], against: side };
    case "solarium":
    case "terrace":
      return { marks: [...marks, ...loungers(room, side)], against: side };
    // A porch deep enough gets an outdoor sofa, its armchairs and a low table, against the house;
    // terraces, patios and walkways stay clear.
    case "deck":
      return room.w >= 3.5 && room.d >= 3.5
        ? { marks: [...marks, ...lounge(room, side)], against: side }
        : { marks };
    default:
      return { marks };
  }
}

// ---- Openings ----------------------------------------------------------------------------------

/** A door's leaf open a quarter turn and its swing; a window's panes; a sliding door's leaves. */
function openingMarks(gap: OpeningGeometry): SheetMark[] {
  const marks: SheetMark[] = [];
  if (gap.swing) {
    const { hinge, leaf } = gap.swing;
    const free =
      Math.hypot(gap.x1 - hinge.x, gap.z1 - hinge.z) < EPS
        ? { x: gap.x2, z: gap.z2 }
        : { x: gap.x1, z: gap.z1 };
    const h = toSheet(hinge.x, hinge.z);
    const l = toSheet(leaf.x, leaf.z);
    const f = toSheet(free.x, free.z);
    const radius = Math.hypot(l.u - h.u, l.v - h.v);
    marks.push({ kind: "line", from: h, to: l, weight: "thin" });
    marks.push({
      kind: "arc",
      centre: h,
      radius,
      from: Math.atan2(l.v - h.v, l.u - h.u),
      to: Math.atan2(f.v - h.v, f.u - h.u),
      weight: "hair",
    });
  }
  const along = Math.abs(gap.z1 - gap.z2) < EPS ? { x: 1, z: 0 } : { x: 0, z: 1 };
  const normal = { x: along.z, z: along.x };
  const pane = (offset: number, from = 0, to = 1, weight: Weight = "fine") => {
    const a = { x: gap.x1 + (gap.x2 - gap.x1) * from, z: gap.z1 + (gap.z2 - gap.z1) * from };
    const b = { x: gap.x1 + (gap.x2 - gap.x1) * to, z: gap.z1 + (gap.z2 - gap.z1) * to };
    marks.push(
      line(
        a.x + normal.x * offset,
        a.z + normal.z * offset,
        b.x + normal.x * offset,
        b.z + normal.z * offset,
        weight,
      ),
    );
  };
  if (gap.kind === "window") {
    pane(-0.05);
    pane(0.05);
    pane(0, 0, 1, "hair");
  }
  if (gap.kind === "sliding") {
    // Its two leaves stacked on the half they close.
    pane(-0.03, 0, 0.5);
    pane(0.03, 0.02, 0.52);
  }
  return marks;
}

// ---- Room labels -------------------------------------------------------------------------------

/** How tall a room's name stands, and its figures under it, in metres. */
const NAME_SIZE = 0.3;
const FIGURE_SIZE = 0.17;
/** About how wide a letter of the name is, as a share of its height, with its tracking. */
const LETTER = 0.78;

function roomLabel(room: Room & { area: number }, against: Side | undefined): SheetMark[] {
  const name = room.name.toLocaleUpperCase("es-ES");
  const figures = `${formatArea(room.area)} · ${dimension(room.w)} × ${dimension(room.d)}`;
  // As large as fits across the room, as the screen sees it: along x.
  const size = Math.min(NAME_SIZE, (room.w * 0.82) / (name.length * LETTER), room.d * 0.2);
  // Off the furniture's wall, in the room's free half.
  const centre = middleOf(room);
  const shift = against ? (room.kind === "dining" ? 0.36 : 0.22) : 0;
  const away = {
    north: { x: 0, z: room.d * shift },
    south: { x: 0, z: -room.d * shift },
    west: { x: room.w * shift, z: 0 },
    east: { x: -room.w * shift, z: 0 },
  }[against ?? "north"];
  const at = toSheet(centre.x + (against ? away.x : 0), centre.z + (against ? away.z : 0));
  return [
    {
      kind: "text",
      at: { u: at.u, v: at.v - size * 0.2 },
      text: name,
      size,
      weight: 700,
      align: "center",
      tracking: 0.12,
    },
    {
      kind: "text",
      at: { u: at.u, v: at.v + size * 0.95 },
      text: figures,
      size: Math.min(FIGURE_SIZE, size * 0.62),
      weight: 400,
      align: "center",
      tracking: 0.04,
    },
  ];
}

// ---- The ground floor's sheet: axes, dimensions, the plot, the title ---------------------------

/** Distinct values, in order, closer than 5 cm taken as one. */
function distinct(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.filter((value, i) => i === 0 || value - sorted[i - 1]! > 0.05);
}

/** A chain of dimensions between marks, along the top or down the side, with its ticks. */
function chain(
  marks: SheetMark[],
  stops: number[],
  at: number,
  across: "top" | "side",
  reach: number,
  size: number,
) {
  const point = (along: number, off = 0): SheetPoint =>
    across === "top" ? { u: along, v: at + off } : { u: at + off, v: along };
  marks.push({
    kind: "line",
    from: point(stops[0]! - 0.3),
    to: point(stops.at(-1)! + 0.3),
    weight: "fine",
  });
  for (const stop of stops) {
    // The extension line back towards the plan, and the slash across the chain.
    marks.push({ kind: "line", from: point(stop, -0.2), to: point(stop, reach), weight: "hair" });
    marks.push({
      kind: "line",
      from: point(stop - 0.09, 0.09),
      to: point(stop + 0.09, -0.09),
      weight: "thin",
    });
  }
  for (let i = 1; i < stops.length; i++) {
    const [a, b] = [stops[i - 1]!, stops[i]!];
    if (b - a < 0.6) continue;
    const middle = point((a + b) / 2, -0.16);
    marks.push({
      kind: "text",
      at: middle,
      text: dimension(b - a),
      size,
      weight: 400,
      align: "center",
      tracking: 0.04,
      upright: across === "side",
    });
  }
}

/** A grid bubble: an axis's name in a circle, with its line towards the plan. */
function bubble(marks: SheetMark[], centre: SheetPoint, name: string, towards: SheetPoint) {
  const r = 0.34;
  const dir = { u: towards.u - centre.u, v: towards.v - centre.v };
  const len = Math.hypot(dir.u, dir.v);
  marks.push({
    kind: "line",
    from: { u: centre.u + (dir.u / len) * r, v: centre.v + (dir.v / len) * r },
    to: towards,
    weight: "hair",
    dash: [0.25, 0.1, 0.05, 0.1],
  });
  marks.push({ kind: "circle", centre, radius: r, weight: "fine", fill: "paper" });
  marks.push({
    kind: "text",
    at: { u: centre.u, v: centre.v + 0.02 },
    text: name,
    size: 0.3,
    weight: 600,
    align: "center",
  });
}

/** A compass star with its north point in ink, pointing the way north is on the sheet. */
function northStar(marks: SheetMark[], centre: SheetPoint) {
  const r = 0.7;
  // North is −z in the world: down the sheet.
  const north = { u: 0, v: 1 };
  const east = { u: -1, v: 0 };
  const tip = (d: SheetPoint, by: number): SheetPoint => ({
    u: centre.u + d.u * by,
    v: centre.v + d.v * by,
  });
  const side = (d: SheetPoint, by: number): SheetPoint => ({
    u: centre.u - d.v * by,
    v: centre.v + d.u * by,
  });
  marks.push({ kind: "circle", centre, radius: r * 0.8, weight: "hair" });
  for (const [d, filled] of [
    [north, true],
    [{ u: -north.u, v: -north.v }, false],
    [east, false],
    [{ u: -east.u, v: -east.v }, false],
  ] as const) {
    marks.push({
      kind: "shape",
      points: [tip(d, r), side(d, 0.16), centre, side(d, -0.16)],
      closed: true,
      weight: "fine",
      fill: filled ? "ink" : "paper",
    });
  }
  marks.push({
    kind: "text",
    at: tip(north, r + 0.36),
    text: "N",
    size: 0.3,
    weight: 700,
    align: "center",
  });
}

/** The title block: the floor's name, the house's, its m² and scale, a scale bar and the north. */
function titleBlock(
  marks: SheetMark[],
  { floor, house, area }: { floor: string; house: string; area: number },
  at: SheetPoint,
  width: number,
  north = true,
) {
  marks.push({
    kind: "text",
    at,
    text: floor.toLocaleUpperCase("es-ES"),
    size: 0.52,
    weight: 600,
    align: "left",
    tracking: 0.1,
  });
  marks.push({
    kind: "text",
    at: { u: at.u, v: at.v + 0.62 },
    text: `${house.toLocaleUpperCase("es-ES")}  ·  COSTA CALMA  ·  ${formatArea(area)}  ·  E 1:100`,
    size: 0.17,
    weight: 400,
    align: "left",
    tracking: 0.08,
  });
  // The scale bar: five metres, in alternate blocks.
  const bar = { u: at.u, v: at.v + 1.05 };
  for (let i = 0; i < 5; i++) {
    marks.push({
      kind: "shape",
      points: [
        { u: bar.u + i, v: bar.v },
        { u: bar.u + i + 1, v: bar.v },
        { u: bar.u + i + 1, v: bar.v + 0.12 },
        { u: bar.u + i, v: bar.v + 0.12 },
      ],
      closed: true,
      weight: "hair",
      fill: i % 2 === 0 ? "ink" : "paper",
    });
  }
  for (const [metres, label] of [
    [0, "0"],
    [1, "1"],
    [2, "2"],
    [5, "5 m"],
  ] as const) {
    marks.push({
      kind: "text",
      at: { u: bar.u + metres, v: bar.v + 0.36 },
      text: label,
      size: 0.15,
      weight: 400,
      align: "center",
    });
  }
  // The north beside the block, clear of its lines.
  if (north) northStar(marks, { u: at.u + width + 0.9, v: at.v + 0.55 });
}

/** The way up to the front door, paved, from the plot's edge. */
function approachPath(marks: SheetMark[], plan: HousePlan) {
  const ground = builtFloors(plan)[0];
  const door =
    ground && floorGeometry(ground, plan).openings.find(({ kind }) => kind === "entrance");
  if (!door) return;
  const across = Math.abs(door.z1 - door.z2) < EPS;
  if (!across) return;
  const house = houseBounds(plan);
  const z = door.z1;
  const toward = z < house.z + house.d / 2 ? plan.plot.z : plan.plot.z + plan.plot.d;
  const x0 = Math.min(door.x1, door.x2) - 0.3;
  const x1 = Math.max(door.x1, door.x2) + 0.3;
  const [za, zb] = [Math.min(z, toward), Math.max(z, toward)];
  marks.push(box({ x: x0, z: za, w: x1 - x0, d: zb - za }, "fine", undefined));
  for (let at = za + 0.6; at < zb - 0.05; at += 0.6) marks.push(line(x0, at, x1, at, "hair"));
}

/** The pool's water in fine hatching, its edge, and its name. */
function poolMarks(marks: SheetMark[], pool: Room) {
  marks.push(box(pool, "thin", undefined));
  const inner = { x: pool.x + 0.15, z: pool.z + 0.15, w: pool.w - 0.3, d: pool.d - 0.3 };
  marks.push(box(inner, "fine", undefined));
  for (let at = 0.35; at < inner.w + inner.d; at += 0.35) {
    // Diagonals across the water, clipped to it.
    const a = { x: inner.x + Math.min(at, inner.w), z: inner.z + Math.max(0, at - inner.w) };
    const b = { x: inner.x + Math.max(0, at - inner.d), z: inner.z + Math.min(at, inner.d) };
    marks.push(line(a.x, a.z, b.x, b.z, "hair"));
  }
  const c = middleOf(pool);
  const at = toSheet(c.x, c.z);
  marks.push({
    kind: "shape",
    points: [
      { u: at.u - 0.9, v: at.v - 0.25 },
      { u: at.u + 0.9, v: at.v - 0.25 },
      { u: at.u + 0.9, v: at.v + 0.25 },
      { u: at.u - 0.9, v: at.v + 0.25 },
    ],
    closed: true,
    weight: "hair",
    fill: "paper",
  });
  marks.push({
    kind: "text",
    at,
    text: "PISCINA",
    size: 0.24,
    weight: 700,
    align: "center",
    tracking: 0.14,
  });
}

/** Deck boards or paving across an open-air room. */
function surface(marks: SheetMark[], room: Room) {
  const step = room.kind === "deck" ? 0.3 : 0.6;
  for (let at = room.z + step; at < room.z + room.d - 0.05; at += step) {
    marks.push(line(room.x, at, room.x + room.w, at, "hair"));
  }
  if (room.kind !== "deck") {
    for (let at = room.x + step; at < room.x + room.w - 0.05; at += step) {
      marks.push(line(at, room.z, at, room.z + room.d, "hair"));
    }
  }
}

/** Where the ground floor's grid runs, and the marks it leaves on the sheet. */
function gridMarks(marks: SheetMark[], rooms: Rect[], extent: Rect) {
  const xs = distinct(rooms.flatMap(({ x, w }) => [x, x + w]));
  const zs = distinct(rooms.flatMap(({ z, d }) => [z, z + d]));
  // On the sheet: across the top, the axes from left to right; down the side, from top to bottom.
  const across = xs.map((x) => -x).sort((a, b) => a - b);
  const down = zs.map((z) => -z).sort((a, b) => a - b);
  const top = -(extent.z + extent.d);
  const left = -(extent.x + extent.w);
  const partial = top - 0.9;
  const overall = top - 1.7;
  const bubbles = top - 2.7;
  chain(marks, across, partial, "top", top - partial - 0.2, 0.2);
  chain(marks, [across[0]!, across.at(-1)!], overall, "top", 0.2, 0.22);
  chain(marks, down, left - 0.9, "side", 0.7, 0.2);
  chain(marks, [down[0]!, down.at(-1)!], left - 1.7, "side", 0.2, 0.22);
  across.forEach((u, i) =>
    bubble(marks, { u, v: bubbles }, String.fromCharCode(65 + i), { u, v: overall - 0.1 }),
  );
  down.forEach((v, i) => bubble(marks, { u: left - 2.7, v }, String(i + 1), { u: left - 1.8, v }));
  return { top: bubbles - 0.4, left: left - 3.1 };
}

/** A storey's m², as its title block gives them: its rooms', its double heights left out. */
const storeyArea = (plan: HousePlan, floor: PlanFloor) =>
  Math.round(
    floorGeometry(floor, plan)
      .rooms.filter(({ kind }) => kind !== "void")
      .reduce((sum, room) => sum + room.area, 0) * 10,
  ) / 10;

/** How far the ground floor's paper runs past what is drawn on it, for its edges to fade. */
const PAPER_MARGIN = 3;

/** One storey's drawing: on the ground floor, the whole sheet. */
export function planSheet(plan: HousePlan, floor: PlanFloor, name: string): SheetDrawing {
  const storeys = builtFloors(plan);
  const ground = floor === storeys[0];
  const geometry = floorGeometry(floor, plan);
  const marks: SheetMark[] = [];
  const plot = plan.floors.find(({ kind }) => kind === "plot");

  if (ground) {
    // The plot's line, dash and dot, and its trees, their crowns dashed round their trunks.
    marks.push({
      ...box(plan.plot, "fine", undefined),
      dash: [0.5, 0.12, 0.08, 0.12],
    } as SheetMark);
    approachPath(marks, plan);
    for (const room of plot?.rooms ?? []) {
      if (room.kind === "pool") poolMarks(marks, room);
      else if (room.kind === "deck" || room.kind === "patio") surface(marks, room);
    }
    for (const { x, z } of plotModel(plan).trees) {
      marks.push({
        kind: "circle",
        centre: toSheet(x, z),
        radius: 1.1,
        weight: "hair",
        dash: [0.12, 0.08],
      });
      marks.push({
        kind: "circle",
        centre: toSheet(x, z),
        radius: 0.16,
        weight: "fine",
        fill: "paper",
      });
    }
  }

  for (const room of geometry.rooms) {
    if (room.kind === "void") {
      // A double height: the floor's slab left open, crossed as an architect marks it.
      marks.push(line(room.x, room.z, room.x + room.w, room.z + room.d, "hair"));
      marks.push(line(room.x + room.w, room.z, room.x, room.z + room.d, "hair"));
      continue;
    }
    if (room.kind === "garden" || room.kind === "stair") continue;
    const furniture = furnitureOf(room, geometry.openings);
    marks.push(...furniture.marks);
    marks.push(...roomLabel(room, furniture.against));
  }
  for (const gap of geometry.openings) marks.push(...openingMarks(gap));
  if (ground) {
    for (const room of plot?.rooms ?? []) {
      if (room.kind === "garden" || room.kind === "pool") continue;
      const withArea = { ...room, area: room.area ?? room.w * room.d };
      const furniture = furnitureOf(room, []);
      marks.push(...furniture.marks, ...roomLabel(withArea, furniture.against));
    }
  }

  // What it covers: the plot, or on an upper floor its own rooms; and the ground floor's margins.
  const house = houseBounds(plan);
  const content: Rect = ground ? plan.plot : house;
  // On the ground floor, past the plot by as much as the paper's edges take to fade.
  const margin = ground ? PAPER_MARGIN : 0.6;
  let bounds = {
    u0: -(content.x + content.w) - margin,
    v0: -(content.z + content.d) - margin,
    u1: -content.x + margin,
    v1: -content.z + margin,
  };
  if (ground) {
    const built = [house, ...(plot?.rooms.filter(({ kind }) => kind !== "garden") ?? [])];
    const x0 = Math.min(...built.map(({ x }) => x));
    const z0 = Math.min(...built.map(({ z }) => z));
    const x1 = Math.max(...built.map(({ x, w }) => x + w));
    const z1 = Math.max(...built.map(({ z, d }) => z + d));
    const rooms = geometry.rooms.filter(({ kind }) => kind !== "void" && kind !== "garden");
    const edge = gridMarks(marks, rooms, { x: x0, z: z0, w: x1 - x0, d: z1 - z0 });
    // The title block at the bottom right, past the plot's edge.
    const width = 6.2;
    const at = { u: -plan.plot.x + 0.9, v: -plan.plot.z - 1.8 };
    titleBlock(marks, { floor: floor.name, house: name, area: storeyArea(plan, floor) }, at, width);
    bounds = {
      u0: Math.min(bounds.u0, edge.left - PAPER_MARGIN),
      v0: Math.min(bounds.v0, edge.top - PAPER_MARGIN),
      u1: Math.max(bounds.u1, at.u + width + 1.8 + PAPER_MARGIN),
      v1: bounds.v1,
    };
  }
  return { bounds, marks };
}

/** The sheet's bounds in the world: what the camera frames on the sheet. */
export function sheetWorldBounds(drawing: SheetDrawing): Rect {
  const { u0, v0, u1, v1 } = drawing.bounds;
  return { x: -u1, z: -v1, w: u1 - u0, d: v1 - v0 };
}

/**
 * The rooms a storey's furniture stands in: its own, and on the ground floor the plot's, the porch
 * and the terraces, which it draws.
 */
function furnishedRooms(plan: HousePlan, floor: PlanFloor) {
  const storeys = builtFloors(plan);
  const geometry = floorGeometry(floor, plan);
  const plot = plan.floors.find(({ kind }) => kind === "plot");
  const rooms: Room[] = [
    ...geometry.rooms.filter(
      ({ kind }) => kind !== "void" && kind !== "garden" && kind !== "stair",
    ),
    ...(floor === storeys[0]
      ? (plot?.rooms ?? []).filter(({ kind }) => kind !== "garden" && kind !== "pool")
      : []),
  ];
  return { geometry, rooms };
}

/** A piece of furniture placed by hand, where it stands over its storey's floor. */
export type PlacedPiece = {
  id: string;
  /** The manifest's piece. */
  piece: string;
  /** Its footprint on the plan. */
  rect: Rect;
  /** Its centre on the plan, where it stands over its floor, and how it is turned. */
  x: number;
  y: number;
  z: number;
  h: number;
  facing: Furniture["facing"];
};

/** A storey's furniture placed by hand: the pieces its model loads, and walks round. */
export function placedFurniture(plan: HousePlan, floor: PlanFloor): PlacedPiece[] {
  return furnishedRooms(plan, floor).rooms.flatMap((room) =>
    (room.furniture ?? []).flatMap((placed, i) => {
      const piece = furniturePieces[placed.piece];
      if (!piece) return [];
      return [
        {
          id: `${room.id}/${i}`,
          piece: placed.piece,
          rect: footprint(placed, piece),
          x: placed.x,
          y: placed.y ?? 0,
          z: placed.z,
          h: piece.size.h,
          facing: placed.facing,
        },
      ];
    }),
  );
}

/** A storey's furniture as it stands in the model, at its floor's level: what its plan draws. */
export function furnitureSolids(plan: HousePlan, floor: PlanFloor): FurnitureSolid[] {
  const { geometry, rooms } = furnishedRooms(plan, floor);
  const solids: FurnitureSolid[] = [];
  for (const room of rooms) {
    const inHouse = geometry.rooms.includes(room as (typeof geometry.rooms)[number]);
    for (const mark of furnitureOf(room, inHouse ? geometry.openings : []).marks) {
      if (mark.kind === "shape" && mark.solid) {
        const us = mark.points.map(({ u }) => -u);
        const vs = mark.points.map(({ v }) => -v);
        const x = Math.min(...us);
        const z = Math.min(...vs);
        solids.push({
          ...mark.solid,
          x,
          z,
          w: Math.max(...us) - x,
          d: Math.max(...vs) - z,
          round: false,
        });
      } else if (mark.kind === "circle" && mark.solid) {
        const { u, v } = mark.centre;
        const r = mark.radius;
        solids.push({ ...mark.solid, x: -u - r, z: -v - r, w: r * 2, d: r * 2, round: true });
      }
    }
  }
  return solids;
}

/** What a drawing's marks reach, in the sheet's metres, and so far past it. */
function marksBounds(marks: SheetMark[], margin: number): SheetDrawing["bounds"] {
  const points = marks.flatMap((mark): SheetPoint[] => {
    switch (mark.kind) {
      case "line":
        return [mark.from, mark.to];
      case "shape":
        return mark.points;
      case "circle":
      case "arc":
        return [
          { u: mark.centre.u - mark.radius, v: mark.centre.v - mark.radius },
          { u: mark.centre.u + mark.radius, v: mark.centre.v + mark.radius },
        ];
      case "text": {
        // Roughly: as wide as its letters, either side of where it is set.
        const half = mark.text.length * mark.size * 0.7;
        return [
          { u: mark.at.u - half, v: mark.at.v - mark.size * 2 },
          { u: mark.at.u + half, v: mark.at.v + mark.size * 2 },
        ];
      }
    }
  });
  return {
    u0: Math.min(...points.map(({ u }) => u)) - margin,
    v0: Math.min(...points.map(({ v }) => v)) - margin,
    u1: Math.max(...points.map(({ u }) => u)) + margin,
    v1: Math.max(...points.map(({ v }) => v)) + margin,
  };
}

/**
 * What a floor picked from the whole house is drawn with round it, as its own sheet: its grid of
 * axes with their bubbles and its chains of dimensions, its title block with its m² and scale,
 * and the north. A storey's runs over its rooms; Exterior's, over the plot, under the ground
 * floor's block, whose north it shares. Its rooms' names and figures are its `planSheet`'s, which
 * the sweep wipes: these stay. On a `portrait` screen the block goes under the floor instead of
 * beside it, for the floor to take the screen's width.
 */
export function floorAnnotations(
  plan: HousePlan,
  floor: PlanFloor,
  name: string,
  portrait = false,
): SheetDrawing {
  const marks: SheetMark[] = [];
  const plot = floor.kind === "plot";
  const rooms: Rect[] = plot
    ? [plan.plot]
    : floorGeometry(floor, plan).rooms.filter(({ kind }) => kind !== "void" && kind !== "garden");
  const x0 = Math.min(...rooms.map(({ x }) => x));
  const z0 = Math.min(...rooms.map(({ z }) => z));
  const extent = {
    x: x0,
    z: z0,
    w: Math.max(...rooms.map(({ x, w }) => x + w)) - x0,
    d: Math.max(...rooms.map(({ z, d }) => z + d)) - z0,
  };
  gridMarks(marks, rooms, extent);
  const area = plot ? planFigures(plan).plotArea : storeyArea(plan, floor);
  // The title block past the floor's bottom right, as the ground floor's sheet has it. Exterior's
  // lies on the ground floor's sheet, under its block, which has the north.
  const below = portrait ? marksBounds(marks, 0) : undefined;
  const at = below
    ? // Under the floor's own edge, not its axes' bubbles: a phone frames the floor close.
      { u: -(extent.x + extent.w), v: below.v1 + 0.9 }
    : { u: -extent.x + (plot ? 0.9 : 1.4), v: -extent.z - (plot ? 0 : 1.8) };
  titleBlock(marks, { floor: floor.name, house: name, area }, at, 6.2, !plot);
  return { bounds: marksBounds(marks, 0.6), marks };
}

/** The ground floor's rooms in words, for those who cannot see the sheet. */
export function describeSheet(name: string, plan: HousePlan) {
  const ground = builtFloors(plan)[0];
  if (!ground) return "";
  const rooms = floorGeometry(ground, plan)
    .rooms.filter(({ kind }) => kind !== "void")
    .map(({ name, area }) => `${name.toLocaleLowerCase("es-ES")}, ${formatArea(area)}`);
  return `Plano de la planta baja de ${name}, visto desde arriba, con la puerta al norte: ${rooms.join("; ")}.`;
}
