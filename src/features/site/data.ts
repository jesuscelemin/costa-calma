import { casaOlivoPlan } from "../houses/plans/casa-olivo.ts";
import { casaPinarPlan } from "../houses/plans/casa-pinar.ts";
import { villaDunaBlancaPlan } from "../houses/plans/villa-duna-blanca.ts";
import type { HousePlan } from "../houses/schema.ts";
import {
  sitePlanSchema,
  type Neighbour,
  type SitePlan,
  type SitePlot,
  type SitePoint,
  type SiteRoadPoint,
  type Zone,
} from "./schema.ts";
import {
  distanceToRoads,
  insidePolygon,
  neighbourCorners,
  plotCorners,
  validateSitePlan,
  type PlansBySlug,
} from "./site-plan.ts";

// Costa Calma's site (ADR 0015), after Jesús's aerial view of the development
// (~/Desktop/Costa Calma/Archivos Referencia/Duna Blanca, urbanización costera de lujo.png): three
// rows of houses stepping up a hillside over a beach, held by dry stone walls, each row along its
// road, and a road that climbs the west end of the hill joining them.
//
// The rows follow long arcs round a centre far to the north, so they run almost straight along
// the beach and bulge gently to the sea. From the sea up:
//
// - the beach, at 0 m, with its dunes;
// - the coast road, at +2,5 m, behind a stone wall, with stairs down to the sand;
// - the front row, at +5 m: the 4 Villa Duna Blanca (units 1–4, west to east), pools and lawns to
//   the sea, entered from the road behind them;
// - that road, at +9 m;
// - the middle row, at +12,5 m: the 6 Casa Olivo (units 11–16), entered from the road below them;
// - the top road, at +16 m;
// - the top row, at +19,5 m: Casa Pinar's 3 semi-detached pairs (units 5–10), farther apart,
//   entered from the road below them;
// - above them, the wild hill.
//
// A collector road climbs the east end of the hill from the coast, as in Jesús's site plan
// (Archivos Referencia/Duna Blanca_ trama urbana costera realista.png): the three local streets run
// west from it, along the rows, and the middle and top ones join round a bend at the west end.
// Round the site, the neighbouring developments: white houses with tiled roofs to the west and up
// the hill, apartment blocks across the collector road.
//
// Each stone wall between two levels holds the higher one.

export const sitePlans: PlansBySlug = {
  "villa-duna-blanca": villaDunaBlancaPlan,
  "casa-pinar": casaPinarPlan,
  "casa-olivo": casaOlivoPlan,
};

/** The site's centre: the front row's road passes through the origin, due south of it. */
const ROW_ROAD_RADIUS = 700;
export const SITE_CENTRE: SitePoint = { x: 0, z: -ROW_ROAD_RADIUS };
const ROAD_WIDTH = 7;
/** Between the kerb and a plot's or a terrace's edge. */
const VERGE = 2;
const ROAD_HALF = ROAD_WIDTH / 2 + VERGE;

/** The roads along the rows: their centre lines' radius and their level. */
const FRONT_ROAD = { radius: ROW_ROAD_RADIUS, level: 9 };
const OLIVO_BACK = FRONT_ROAD.radius - ROAD_HALF - 25 - 3;
const TOP_ROAD = { radius: OLIVO_BACK - ROAD_HALF, level: 16 };
const PINAR_BACK = TOP_ROAD.radius - ROAD_HALF - 26 - 4;

const DUNA_FRONT = FRONT_ROAD.radius + ROAD_HALF;
const COAST_WALL = DUNA_FRONT + 26.4 + 4;
const COAST_ROAD = { radius: COAST_WALL + ROAD_HALF, level: 2.5 };
const BEACH_TOP = COAST_ROAD.radius + ROAD_HALF;
const BEACH = 24;

/** Angles, in radians from due south: where each row's terrace and each road ends. */
const DUNA_SPAN = 0.125;
const OLIVO_SPAN = 0.13;
const PINAR_SPAN = 0.115;
const COAST_WEST = -0.3;
/** The local streets' west ends: the coast road runs on; the middle and top ones join in a bend. */
const LOCAL_WEST = -0.15;
const WEST_BEND = -0.172;
/** The collector road: from the coast east of the site, up the hill. */

const COLLECTOR_TOP = { angle: 0.15, radius: 520, level: 62 };

const atPolar = (radius: number, angle: number): SitePoint => ({
  x: SITE_CENTRE.x + radius * Math.sin(angle),
  z: SITE_CENTRE.z + radius * Math.cos(angle),
});

const polarOf = ({ x, z }: SitePoint) => ({
  radius: Math.hypot(x - SITE_CENTRE.x, z - SITE_CENTRE.z),
  angle: Math.atan2(x - SITE_CENTRE.x, z - SITE_CENTRE.z),
});

/** A line round the hill: its radius at each angle. */
type Contour = (angle: number) => number;

const circle =
  (radius: number): Contour =>
  () =>
    radius;

/**
 * A contour that wanders with the lie of the land, `amplitude` metres either way of `radius`.
 * The same `seed` gives the same wander, so neighbouring walls can follow each other.
 */
const wandering =
  (radius: number, amplitude: number, seed: number): Contour =>
  (angle) =>
    radius +
    amplitude * (0.6 * Math.sin(7 * angle + seed) + 0.4 * Math.sin(13 * angle + 2.3 * seed));

/** Points along a contour, from one angle to another. */
function along(contour: Contour, from: number, to: number, step = 0.015): SitePoint[] {
  const count = Math.max(1, Math.ceil(Math.abs(to - from) / step));
  return Array.from({ length: count + 1 }, (_, i) => {
    const angle = from + ((to - from) * i) / count;
    return atPolar(contour(angle), angle);
  });
}

/** The band between two contours, from one angle to another, as a closed outline. */
function band(inner: Contour, outer: Contour, from: number, to: number): SitePoint[] {
  return [...along(inner, from, to), ...along(outer, to, from)].map(roundPoint);
}

/** A level stretch of road along a circle. */
const stretch = (radius: number, level: number, from: number, to: number): SiteRoadPoint[] =>
  along(circle(radius), from, to).map((point) => ({ ...point, y: level }));

type Polar = { radius: number; angle: number };

/**
 * The climbing road: a cubic Bézier through two control points (all as radius and angle), its level
 * at each point taken from how far up the hill it is, so it meets each road it crosses at that
 * road's level.
 */
function climb(
  from: Polar,
  c1: Polar,
  c2: Polar,
  to: Polar,
  levels: { radius: number; level: number }[],
  steps = 40,
): SiteRoadPoint[] {
  const [p0, p1, p2, p3] = [from, c1, c2, to].map(({ radius, angle }) =>
    atPolar(radius, angle),
  ) as [SitePoint, SitePoint, SitePoint, SitePoint];
  const byRadius = levels.toSorted((a, b) => a.radius - b.radius);
  const levelAt = (radius: number) => {
    const upper = byRadius.findIndex((l) => l.radius >= radius);
    if (upper <= 0) return byRadius[upper === 0 ? 0 : byRadius.length - 1]!.level;
    const lo = byRadius[upper - 1]!;
    const hi = byRadius[upper]!;
    return lo.level + ((hi.level - lo.level) * (radius - lo.radius)) / (hi.radius - lo.radius);
  };
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    const u = 1 - t;
    const b = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t] as const;
    const point = {
      x: b[0] * p0.x + b[1] * p1.x + b[2] * p2.x + b[3] * p3.x,
      z: b[0] * p0.z + b[1] * p1.z + b[2] * p2.z + b[3] * p3.z,
    };
    return { ...point, y: levelAt(polarOf(point).radius) };
  });
}

/** Where a road crosses a circle: the angle of its first point that far from the centre. */
function crossing(road: SiteRoadPoint[], radius: number): number {
  for (let i = 1; i < road.length; i++) {
    const a = polarOf(road[i - 1]!);
    const b = polarOf(road[i]!);
    if ((a.radius - radius) * (b.radius - radius) <= 0) {
      const t = (radius - a.radius) / (b.radius - a.radius);
      return a.angle + (b.angle - a.angle) * t;
    }
  }
  throw new Error(`The road never reaches radius ${radius}`);
}

type RowPlot = { unit: number; houseType: string; mirrored?: boolean; gapBefore?: number };

/**
 * Plots side by side along an arc, west to east, centred on due south. `edge` is the radius of the
 * edge that faces the road: the plots stand outside it (`side: "outer"`, the front row) or inside
 * it (`"inner"`, the second row). Each plot turns to face the centre, so its plan's south looks away
 * from it, to the sea. Plots with no gap before them join the one before into a block that turns as
 * one, as the two halves of a semi-detached pair must.
 */
function row(plots: RowPlot[], edge: number, side: "outer" | "inner"): SitePlot[] {
  const blocks: { gapBefore: number; members: (RowPlot & { w: number; d: number })[] }[] = [];
  plots.forEach((plot, i) => {
    const { w, d } = (sitePlans[plot.houseType] as HousePlan).plot;
    const member = { ...plot, w, d };
    const last = blocks.at(-1);
    if (i > 0 && plot.gapBefore === 0 && last) last.members.push(member);
    else blocks.push({ gapBefore: i === 0 ? 0 : (plot.gapBefore ?? 0), members: [member] });
  });
  const sized = blocks.map((block) => {
    const w = block.members.reduce((sum, member) => sum + member.w, 0);
    const d = Math.max(...block.members.map((member) => member.d));
    // Inside an arc, a straight edge reaches it at its corners, not at its middle.
    const radius = side === "outer" ? edge + d / 2 : Math.sqrt(edge ** 2 - (w / 2) ** 2) - d / 2;
    return { ...block, w, d, radius };
  });
  const total = sized.reduce((sum, { gapBefore, w }) => sum + gapBefore + w, 0);
  let along = -total / 2;
  return sized.flatMap(({ gapBefore, members, w, d, radius }) => {
    along += gapBefore + w / 2;
    const angle = along / radius;
    along += w / 2;
    const centre = atPolar(radius, angle);
    // Along the block, eastwards as it turns: the tangent of the arc.
    const tangent = { x: Math.cos(angle), z: -Math.sin(angle) };
    const outwards = { x: Math.sin(angle), z: Math.cos(angle) };
    let offset = -w / 2;
    return members.map(({ unit, houseType, mirrored, w: width, d: depth }) => {
      offset += width / 2;
      // A shallower member keeps its road edge in line with the block's.
      const shift = side === "outer" ? (depth - d) / 2 : (d - depth) / 2;
      const at = {
        x: centre.x + tangent.x * offset + outwards.x * shift,
        z: centre.z + tangent.z * offset + outwards.z * shift,
      };
      offset += width / 2;
      return {
        unit,
        houseType,
        x: round(at.x),
        z: round(at.z),
        rotation: round((-angle * 180) / Math.PI),
        ...(mirrored ? { mirrored } : {}),
      };
    });
  });
}

const round = (value: number) => Math.round(value * 1000) / 1000;

/** A zone round its plots: the ring sector that holds them, with a margin. */
function zoneAround(houseType: string, name: string, plots: SitePlot[], margin = 3): Zone {
  const polar = plots
    .filter((plot) => plot.houseType === houseType)
    .flatMap((plot) => plotCorners(plot, sitePlans[plot.houseType] as HousePlan))
    .map(polarOf);
  const inner = Math.min(...polar.map(({ radius }) => radius)) - margin;
  const outer = Math.max(...polar.map(({ radius }) => radius)) + margin;
  const from = Math.min(...polar.map(({ angle }) => angle)) - margin / inner;
  const to = Math.max(...polar.map(({ angle }) => angle)) + margin / inner;
  return {
    houseType,
    name,
    outline: [...along(circle(inner), from, to), ...along(circle(outer), to, from)].map(roundPoint),
  };
}

const roundPoint = ({ x, z }: SitePoint): SitePoint => ({ x: round(x), z: round(z) });

const frontRow = row(
  [1, 2, 3, 4].map((unit) => ({ unit, houseType: "villa-duna-blanca", gapBefore: 3 })),
  DUNA_FRONT,
  "outer",
);

const olivoRow = row(
  [11, 12, 13, 14, 15, 16].map((unit) => ({ unit, houseType: "casa-olivo", gapBefore: 3.6 })),
  FRONT_ROAD.radius - ROAD_HALF,
  "inner",
);

// Casa Pinar's plan has its party wall to the west: the western half of each pair is its mirror.
const pinarRow = row(
  [5, 6, 7, 8, 9, 10].map((unit, i) => ({
    unit,
    houseType: "casa-pinar",
    ...(i % 2 === 0 ? { mirrored: true, gapBefore: 24 } : { gapBefore: 0 }),
  })),
  TOP_ROAD.radius - ROAD_HALF,
  "inner",
);

const plots = [...frontRow, ...olivoRow, ...pinarRow];

const shore = wandering(BEACH_TOP + BEACH, 5, 5.5);
const roadBand = (radius: number) =>
  [circle(radius - ROAD_HALF), circle(radius + ROAD_HALF)] as const;
const roundRoad = (points: SiteRoadPoint[]) =>
  points.map(({ x, z, y }) => ({ x: round(x), z: round(z), y: round(y) }));

const LEVELS = [COAST_ROAD, FRONT_ROAD, TOP_ROAD, COLLECTOR_TOP];

// The collector road: in from the coast to the south-east, up the east end of the hill, past the
// end of each local street.
const collectorRoad = climb(
  { radius: BEACH_TOP + 6, angle: 0.3 },
  { radius: COAST_ROAD.radius - 10, angle: 0.2 },
  { radius: TOP_ROAD.radius - 30, angle: 0.155 },
  COLLECTOR_TOP,
  LEVELS,
  48,
);
const COAST_EAST = crossing(collectorRoad, COAST_ROAD.radius);
const FRONT_EAST = crossing(collectorRoad, FRONT_ROAD.radius);
const TOP_EAST = crossing(collectorRoad, TOP_ROAD.radius);

// The bend joining the top street to the middle one round the west end of Casa Olivo's row.
const westBend = climb(
  { radius: TOP_ROAD.radius, angle: LOCAL_WEST },
  { radius: TOP_ROAD.radius, angle: WEST_BEND },
  { radius: FRONT_ROAD.radius, angle: WEST_BEND },
  { radius: FRONT_ROAD.radius, angle: LOCAL_WEST },
  LEVELS,
);

const development = {
  terraces: [
    {
      kind: "row",
      level: 19.5,
      planting: "garden",
      outline: band(
        wandering(PINAR_BACK, 2, 1),
        circle(TOP_ROAD.radius - ROAD_HALF),
        -PINAR_SPAN,
        PINAR_SPAN,
      ),
    },
    {
      kind: "road",
      level: TOP_ROAD.level,
      outline: band(...roadBand(TOP_ROAD.radius), LOCAL_WEST, TOP_EAST),
    },
    {
      kind: "row",
      level: 12.5,
      planting: "garden",
      outline: band(
        circle(OLIVO_BACK),
        circle(FRONT_ROAD.radius - ROAD_HALF),
        -OLIVO_SPAN,
        OLIVO_SPAN,
      ),
    },
    {
      kind: "road",
      level: FRONT_ROAD.level,
      outline: band(...roadBand(FRONT_ROAD.radius), LOCAL_WEST, FRONT_EAST),
    },
    {
      kind: "row",
      level: 5,
      planting: "garden",
      outline: band(circle(DUNA_FRONT), circle(COAST_WALL), -DUNA_SPAN, DUNA_SPAN),
    },
    {
      kind: "road",
      level: COAST_ROAD.level,
      outline: band(...roadBand(COAST_ROAD.radius), COAST_WEST, COAST_EAST),
    },
    {
      kind: "beach",
      level: 0,
      outline: band(circle(BEACH_TOP), shore, COAST_WEST, COAST_EAST + 0.03),
    },
  ],
  shoreline: along(shore, COAST_WEST, COAST_EAST + 0.03).map(roundPoint),
  roads: [
    {
      id: "coast",
      centre: roundRoad(stretch(COAST_ROAD.radius, COAST_ROAD.level, COAST_WEST, COAST_EAST)),
      width: ROAD_WIDTH,
    },
    {
      id: "middle",
      centre: roundRoad(stretch(FRONT_ROAD.radius, FRONT_ROAD.level, LOCAL_WEST, FRONT_EAST)),
      width: ROAD_WIDTH,
    },
    {
      id: "top",
      centre: roundRoad(stretch(TOP_ROAD.radius, TOP_ROAD.level, LOCAL_WEST, TOP_EAST)),
      width: ROAD_WIDTH,
    },
    { id: "west-bend", centre: roundRoad(westBend), width: ROAD_WIDTH },
    { id: "collector", centre: roundRoad(collectorRoad), width: ROAD_WIDTH + 2 },
  ],
  plots,
  zones: [
    zoneAround("villa-duna-blanca", "Primera línea", plots),
    zoneAround("casa-olivo", "Casa Olivo", plots),
    zoneAround("casa-pinar", "Casa Pinar", plots),
  ],
};

/** A small seeded random, so the neighbours come out the same every time. */
function seeded(seed: number) {
  let t = seed;
  return () => {
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The neighbouring developments: a loose grid of buildings over a ring sector, each turned to face
 * the sea, kept off the roads, the development and its beach.
 */
function neighbourhood(
  kind: Neighbour["kind"],
  radii: [number, number],
  angles: [number, number],
  spacing: number,
  random: () => number,
): Neighbour[] {
  const found: Neighbour[] = [];
  for (let radius = radii[0]; radius <= radii[1]; radius += spacing) {
    const step = spacing / radius;
    for (let angle = angles[0]; angle <= angles[1]; angle += step) {
      if (random() < 0.22) continue;
      const jitter = (amount: number) => (random() - 0.5) * amount;
      const at = atPolar(radius + jitter(spacing * 0.3), angle + jitter(step * 0.3));
      const apartments = kind === "apartments";
      const neighbour: Neighbour = {
        kind,
        x: round(at.x),
        z: round(at.z),
        w: apartments ? 30 + Math.round(random() * 12) : 11 + Math.round(random() * 6),
        d: apartments ? 12 : 9 + Math.round(random() * 4),
        rotation: round((-angle * 180) / Math.PI + jitter(12)),
        storeys: apartments ? 3 + Math.round(random()) : 1 + Math.round(random()),
        ...(!apartments && random() < 0.35 ? { pool: true } : {}),
      };
      const corners = neighbourCorners(neighbour).concat({ x: neighbour.x, z: neighbour.z });
      const clear =
        corners.every((c) => distanceToRoads(c, development) > ROAD_WIDTH) &&
        !development.terraces.some(({ outline }) =>
          corners.some((c) => insidePolygon(c, outline)),
        ) &&
        found.every(
          (other) => Math.hypot(other.x - neighbour.x, other.z - neighbour.z) > spacing * 0.7,
        );
      if (clear) found.push(neighbour);
    }
  }
  return found;
}

const random = seeded(2026);
export const sitePlan: SitePlan = sitePlanSchema.parse({
  ...development,
  neighbours: [
    // West of the site, down to the coast road.
    ...neighbourhood("house", [600, 752], [-0.46, -0.2], 22, random),
    // Up the hill, above Casa Pinar.
    ...neighbourhood("house", [500, 595], [-0.42, 0.12], 26, random),
    // Across the collector road: apartment blocks, and houses higher up.
    ...neighbourhood("apartments", [640, 750], [0.24, 0.46], 34, random),
    ...neighbourhood("house", [520, 630], [0.2, 0.46], 24, random),
  ],
});

const problems = validateSitePlan(sitePlan, sitePlans);
if (problems.length > 0) throw new Error(`The site plan is wrong:\n${problems.join("\n")}`);
