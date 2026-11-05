import {
  floorGeometry,
  sectionCut,
  type OpeningGeometry,
  type WallKind,
} from "@/features/houses/plan";
import type { HousePlan, PlanFloor, Room, SectionPlane } from "@/features/houses/schema";
import { formatLength, formatLevel } from "@/lib/format";

import {
  LAND_DEPTH,
  openingHead,
  POOL_DEPTH,
  POOL_RIM,
  RAILING_HEIGHT,
  SLAB_DEPTH,
  STOREY_HEIGHT,
  WALL_HEIGHT,
  WALL_THICKNESS,
  WATER_BELOW_EDGE,
  type InkLine,
} from "./model-geometry";
import { floorLevel } from "./tour";

// A house type's corte: the house cut by the vertical plane its plan declares, as stretches along
// that plane and heights in metres. Pure: the SVG drawing, and later the model and the tour's
// locator, all read the section through here. `u` runs along the cut (north to south on a
// north–south one), `y` up from the ground floor's finished floor, +0,00.

/** A stretch along the cut. */
export type Stretch = { from: number; to: number };

export type SectionRoom = Stretch & {
  /** The floor it is on. */
  floor: string;
  id: string;
  name: string;
  kind: Room["kind"];
  open: boolean;
};

/** A wall the cut goes through, standing on its floor's level. */
export type SectionWall = {
  floor: string;
  /** Where it stands along the cut: the middle of its thickness. */
  at: number;
  kind: WallKind;
  thickness: number;
  /** Its foot and its height: up to the slab above, or a railing's. */
  y: number;
  height: number;
  /** The opening the cut goes through, if any: the gap from its sill up to its head. */
  opening?: { kind: OpeningGeometry["kind"]; sill: number; head: number };
};

/** A built floor's level: where its finished floor stands. */
export type SectionLevel = { floor: string; name: string; y: number; label: string };

/** A stretch of a floor's slab, from `y` − `depth` up to its level, `y`. */
export type SectionSlab = Stretch & { floor: string; y: number; depth: number };

/** A room of the floor below that rises through a double height: from `y` up `height` metres. */
export type SectionDoubleHeight = Stretch & {
  floor: string;
  room: string;
  y: number;
  height: number;
};

/** A stretch of a floor that reaches past the floor below, and the plot's rooms under it. */
export type SectionOverhang = Stretch & { floor: string; over: string[] };

export type HouseSection = {
  /** The plane it is cut by, as the plan declares it. */
  plane: SectionPlane;
  rooms: SectionRoom[];
  walls: SectionWall[];
  levels: SectionLevel[];
  slabs: SectionSlab[];
  doubleHeights: SectionDoubleHeight[];
  overhangs: SectionOverhang[];
  /** The cotas along the cut: where its walls stand, on every floor, from first to last. */
  dimensions: number[];
  /** The plot's land, `depth` deep under +0,00. */
  terrain: Stretch & { depth: number };
  /** The pool sunk into it: its hollow `depth` deep, its water at `water`, its walls `rim` thick. */
  pool?: Stretch & { depth: number; water: number; rim: number };
};

const EPS = 1e-6;

const isBackground = (room: Room) => room.kind === "garden";
const isVoid = (room: Room) => room.kind === "void";

function roomsCut(plan: HousePlan, floor: PlanFloor): SectionRoom[] {
  const { section } = plan;
  if (!section) return [];
  return floor.rooms
    .filter((room) => !isBackground(room) && !isVoid(room))
    .flatMap((room) => {
      const cut = sectionCut(room, section);
      if (!cut) return [];
      const { id, name, kind } = room;
      return [{ ...cut, floor: floor.id, id, name, kind, open: room.open ?? false }];
    })
    .sort((a, b) => a.from - b.from);
}

/** Where a line on the plan crosses the cut, along it; undefined if it runs along it or misses. */
function crossing({ x1, z1, x2, z2 }: InkLine, { runs, at }: SectionPlane) {
  // `a` across the cut, `b` along it: a line crosses the cut if it runs across it, at one `b`.
  const [a1, a2, b1, b2] = runs === "north-south" ? [x1, x2, z1, z2] : [z1, z2, x1, x2];
  if (Math.abs(b1 - b2) > EPS) return undefined;
  return at > Math.min(a1, a2) + EPS && at < Math.max(a1, a2) - EPS ? b1 : undefined;
}

/** The built floors above the plot, each at its level: the ground floor at +0,00. */
const levelOf = (plan: HousePlan, floor: PlanFloor) => floorLevel(plan, floor.id);

function wallsCut(plan: HousePlan, floor: PlanFloor): SectionWall[] {
  const { section } = plan;
  if (!section || floor.kind === "plot") return [];
  const y = levelOf(plan, floor);
  const geometry = floorGeometry(floor, plan);
  const walls = geometry.walls.flatMap(({ kind, ...line }): SectionWall[] => {
    const at = crossing(line, section);
    if (at === undefined) return [];
    const height = kind === "railing" ? RAILING_HEIGHT : WALL_HEIGHT;
    return [{ floor: floor.id, at, kind, thickness: WALL_THICKNESS[kind], y, height }];
  });
  // Where the cut goes through an opening, its wall is cut out of the walls: it stands again here,
  // around the gap.
  const openings = geometry.openings.flatMap((opening): SectionWall[] => {
    const at = crossing(opening, section);
    if (at === undefined) return [];
    const kind = opening.kind === "door" || opening.kind === "passage" ? "interior" : "exterior";
    const { sill = 0 } = opening;
    return [
      {
        floor: floor.id,
        at,
        kind,
        thickness: WALL_THICKNESS[kind],
        y,
        height: WALL_HEIGHT,
        opening: { kind: opening.kind, sill, head: openingHead(opening) },
      },
    ];
  });
  return [...walls, ...openings].sort((a, b) => a.at - b.at);
}

/** Stretches that touch or overlap, joined. */
function merge(stretches: Stretch[]): Stretch[] {
  const joined: Stretch[] = [];
  for (const { from, to } of [...stretches].sort((a, b) => a.from - b.from)) {
    const last = joined.at(-1);
    if (last && from <= last.to + EPS) last.to = Math.max(last.to, to);
    else joined.push({ from, to });
  }
  return joined;
}

const builtFloors = (plan: HousePlan) => plan.floors.filter(({ kind }) => kind !== "plot");

function slabsCut(plan: HousePlan, floor: PlanFloor): SectionSlab[] {
  if (floor.kind === "plot") return [];
  const y = levelOf(plan, floor);
  // A double height has no slab: it is not among the rooms cut.
  return merge(roomsCut(plan, floor)).map((stretch) => ({
    ...stretch,
    floor: floor.id,
    y,
    depth: SLAB_DEPTH,
  }));
}

function doubleHeightsCut(plan: HousePlan, floor: PlanFloor): SectionDoubleHeight[] {
  const { section } = plan;
  const built = builtFloors(plan);
  const below = built[built.indexOf(floor) - 1];
  if (!section || !below) return [];
  return floor.rooms.filter(isVoid).flatMap((room) => {
    const cut = sectionCut(room, section);
    // The plan checks a double height stands over a room of the floor below.
    const under = below.rooms.find((other) => sectionCut(other, section) && contains(other, room));
    if (!cut || !under) return [];
    const y = levelOf(plan, below);
    return [
      {
        ...cut,
        floor: below.id,
        room: under.id,
        y,
        height: levelOf(plan, floor) + STOREY_HEIGHT - y,
      },
    ];
  });
}

/** What a floor takes along the cut, double heights included. */
function footprint({ section }: HousePlan, floor: PlanFloor) {
  if (!section) return [];
  return merge(
    floor.rooms
      .filter((room) => !isBackground(room))
      .flatMap((room) => sectionCut(room, section) ?? []),
  );
}

/** The stretches of `stretches` that none of `cuts` covers. */
function without(stretches: Stretch[], cuts: Stretch[]): Stretch[] {
  return stretches.flatMap((stretch) => {
    let pieces = [stretch];
    for (const cut of cuts) {
      pieces = pieces.flatMap(({ from, to }) =>
        [
          { from, to: Math.min(to, cut.from) },
          { from: Math.max(from, cut.to), to },
        ].filter((piece) => piece.to - piece.from > EPS),
      );
    }
    return pieces;
  });
}

function overhangsCut(plan: HousePlan, floor: PlanFloor): SectionOverhang[] {
  const built = builtFloors(plan);
  const below = built[built.indexOf(floor) - 1];
  const plot = plan.floors.find(({ kind }) => kind === "plot");
  if (!below) return [];
  const plotRooms = plot ? roomsCut(plan, plot) : [];
  return without(footprint(plan, floor), footprint(plan, below)).map((stretch) => ({
    ...stretch,
    floor: floor.id,
    over: plotRooms
      .filter((room) => room.from < stretch.to - EPS && room.to > stretch.from + EPS)
      .map(({ id }) => id),
  }));
}

const contains = (outer: Room, inner: Room) =>
  inner.x >= outer.x - EPS &&
  inner.z >= outer.z - EPS &&
  inner.x + inner.w <= outer.x + outer.w + EPS &&
  inner.z + inner.d <= outer.z + outer.d + EPS;

/** The plan's corte, or undefined if it declares none. */
export function houseSection(plan: HousePlan): HouseSection | undefined {
  const { section } = plan;
  if (!section) return undefined;
  const pool = plan.floors
    .flatMap(({ rooms }) => rooms)
    .filter(({ kind }) => kind === "pool")
    .map((room) => sectionCut(room, section))
    .find((cut) => cut !== undefined);
  const walls = plan.floors.flatMap((floor) => wallsCut(plan, floor));
  return {
    plane: section,
    rooms: plan.floors.flatMap((floor) => roomsCut(plan, floor)),
    walls,
    levels: builtFloors(plan).map((floor) => {
      const y = levelOf(plan, floor);
      return { floor: floor.id, name: floor.name, y, label: formatLevel(y) };
    }),
    slabs: plan.floors.flatMap((floor) => slabsCut(plan, floor)),
    doubleHeights: plan.floors.flatMap((floor) => doubleHeightsCut(plan, floor)),
    overhangs: builtFloors(plan).flatMap((floor) => overhangsCut(plan, floor)),
    dimensions: [
      ...new Set(walls.filter(({ kind }) => kind !== "railing").map(({ at }) => at)),
    ].sort((a, b) => a - b),
    terrain: { ...sectionCut(plan.plot, section)!, depth: LAND_DEPTH },
    ...(pool && {
      pool: { ...pool, depth: POOL_DEPTH, water: -WATER_BELOW_EDGE, rim: POOL_RIM },
    }),
  };
}

/** Rounded to the centimetre, as a cota reads. */
export const toCentimetre = (metres: number) => Math.round(metres * 100) / 100;

/** Which way a corte runs, as its caption says it. */
export const sectionRuns = ({ runs }: SectionPlane) =>
  runs === "north-south" ? "de norte a sur" : "de oeste a este";

const listInSpanish = new Intl.ListFormat("es-ES", { type: "conjunction" });
const lowerFirst = (name: string) => name.charAt(0).toLowerCase() + name.slice(1);

/**
 * The corte in words, for those who cannot see it: each floor at its level with the rooms the cut
 * goes through, the double heights, the overhangs, and what lies in the plot.
 */
export function describeSection(
  name: string,
  { plane, rooms, levels, doubleHeights, overhangs }: HouseSection,
) {
  const roomsByName = (ids: string[]) =>
    listInSpanish.format(
      ids.flatMap((id) => {
        const room = rooms.find((room) => room.id === id);
        return room ? [`el ${lowerFirst(room.name)}`] : [];
      }),
    );
  const floors = levels.map(({ floor, name: floorName, label }) => {
    const cut = rooms.filter((room) => room.floor === floor).map(({ name }) => lowerFirst(name));
    const rising = doubleHeights
      .filter((height) => height.floor === floor)
      .map(
        ({ room, height }) =>
          `; ${roomsByName([room])} sube a doble altura, ${formatLength(height)}`,
      );
    const flying = overhangs
      .filter((overhang) => overhang.floor === floor)
      .map(
        ({ from, to, over }) =>
          `; vuela ${formatLength(toCentimetre(to - from))}${over.length ? ` sobre ${roomsByName(over)}` : ""}`,
      );
    return `${floorName}, a ${label}: ${listInSpanish.format(cut)}${rising.join("")}${flying.join("")}.`;
  });
  const plot = rooms.filter((room) => !levels.some(({ floor }) => floor === room.floor));
  const outside = plot.length
    ? ` En el jardín, hacia el mar: ${listInSpanish.format(plot.map(({ name }) => lowerFirst(name)))}.`
    : "";
  return `Corte de ${name} ${sectionRuns(plane)}. ${floors.join(" ")}${outside}`;
}
