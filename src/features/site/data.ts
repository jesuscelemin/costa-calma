import { casaOlivoPlan } from "../houses/plans/casa-olivo.ts";
import { casaPinarPlan } from "../houses/plans/casa-pinar.ts";
import { villaDunaBlancaPlan } from "../houses/plans/villa-duna-blanca.ts";
import type { HousePlan } from "../houses/schema.ts";
import {
  sitePlanSchema,
  type SitePlan,
  type SitePlot,
  type SitePoint,
  type SiteRoadPoint,
  type Zone,
} from "./schema.ts";
import { plotCorners, validateSitePlan, type PlansBySlug } from "./site-plan.ts";

// Costa Calma's site (ADR 0015), after Jesús's aerial view of the development
// (~/Desktop/Duna_Blanca/08_vista_urbanización.png) and the hillsides of his references (Clos des
// Vignes, Llindar): a slope over a beach, cut into bancales by dry stone walls that follow the
// curves of the hill, and a road that zigzags up it, one stretch per zone.
//
// The stretches and the rows follow arcs round a centre to the north, so the development bulges
// towards the sea. Walls away from houses and roads wander with the lie of the land. From the sea
// up:
//
// - the beach, at 0 m, and a boardwalk promenade along its top, at +1,5 m;
// - the front row, at +4 m: the 4 Villa Duna Blanca (units 1–4, west to east), pools and gardens
//   to the sea, entered from the road's first stretch behind them, at +8 m, which comes in from
//   the coast road to the west;
// - a bancal at +11 m, and a hairpin bend to the east up to the second stretch, at +14 m;
// - Casa Pinar at +18 m, above the second stretch and entered from it: 3 semi-detached pairs
//   (units 5–10), pools behind;
// - a bancal at +21 m, and a hairpin bend to the west up to the third stretch, at +24 m;
// - Casa Olivo at +28 m, above the third stretch and entered from it (units 11–16), pools behind;
// - above them, bancales of vines and olives 3 m apart, narrowing as the hill rises, and pines on
//   the top.
//
// Each stone wall between two levels holds the higher one.

export const sitePlans: PlansBySlug = {
  "villa-duna-blanca": villaDunaBlancaPlan,
  "casa-pinar": casaPinarPlan,
  "casa-olivo": casaOlivoPlan,
};

/** The site's centre: the first stretch's centre line passes through the origin, due south of it. */
const FIRST_RADIUS = 300;
export const SITE_CENTRE: SitePoint = { x: 0, z: -FIRST_RADIUS };
const ROAD_WIDTH = 7;
/** Between the kerb and a plot's or a bancal's edge. */
const VERGE = 2;
const ROAD_HALF = ROAD_WIDTH / 2 + VERGE;

/** The three stretches of road, from the sea up: their centre lines' radius and their level. */
const FIRST = { radius: FIRST_RADIUS, level: 8 };
/** Between two stretches of road, a narrow bancal: the rows sit close, as in Jesús's references. */
const BETWEEN = 4;
const SECOND = { radius: FIRST_RADIUS - 2 * ROAD_HALF - BETWEEN, level: 14 };
const PINAR_BACK = SECOND.radius - ROAD_HALF - 26 - 3;
const THIRD = { radius: PINAR_BACK - BETWEEN - ROAD_HALF, level: 24 };
const OLIVO_BACK = THIRD.radius - ROAD_HALF - 25 - 6;

const DUNA_FRONT = FIRST.radius + ROAD_HALF;
const SEA_WALL = DUNA_FRONT + 26.4 + 9;
const PROMENADE = 4;
const BEACH = 26;

/** The bancales above Casa Olivo: how many, how deep each, how much higher each. */
const BANCALES = 6;
const BANCAL_DEPTH = 9;
const BANCAL_RISE = 3;

/** Angles, in radians from due south: the site's ends, and where the hairpin bends turn. */
const WEST_END = -0.44;
const EAST_END = 0.44;
const EAST_BEND = 0.32;
const WEST_BEND = -0.37;
const THIRD_END = 0.39;

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

/**
 * A hairpin bend: half a circle from one radius to another at the same angle, bulging east
 * (`direction` 1) or west (-1), climbing from one level to the other.
 */
function hairpin(
  from: { radius: number; level: number },
  to: { radius: number; level: number },
  angle: number,
  direction: 1 | -1,
  steps = 16,
): SiteRoadPoint[] {
  const middle = (from.radius + to.radius) / 2;
  const half = (from.radius - to.radius) / 2;
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = (Math.PI * i) / steps;
    const point = atPolar(
      middle + half * Math.cos(t),
      angle + (direction * half * Math.sin(t)) / middle,
    );
    return { ...point, y: from.level + ((to.level - from.level) * i) / steps };
  });
}

/** A level stretch of road along a circle. */
const stretch = (radius: number, level: number, from: number, to: number): SiteRoadPoint[] =>
  along(circle(radius), from, to).map((point) => ({ ...point, y: level }));

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

// Casa Pinar's plan has its party wall to the west: the western half of each pair is its mirror.
const pinarRow = row(
  [5, 6, 7, 8, 9, 10].map((unit, i) => ({
    unit,
    houseType: "casa-pinar",
    ...(i % 2 === 0 ? { mirrored: true, gapBefore: 6 } : { gapBefore: 0 }),
  })),
  SECOND.radius - ROAD_HALF,
  "inner",
);

const olivoRow = row(
  [11, 12, 13, 14, 15, 16].map((unit) => ({ unit, houseType: "casa-olivo", gapBefore: 2 })),
  THIRD.radius - ROAD_HALF,
  "inner",
);

const plots = [...frontRow, ...pinarRow, ...olivoRow];

/** The bancales above Casa Olivo, from the lowest up, each held by the wall below it. */
const bancales = Array.from({ length: BANCALES }, (_, i) => {
  const lower = wandering(OLIVO_BACK - i * BANCAL_DEPTH, 3 + i * 0.6, 1 + i * 0.4);
  const upper = wandering(OLIVO_BACK - (i + 1) * BANCAL_DEPTH, 3.6 + i * 0.6, 1.4 + i * 0.4);
  const top = i === BANCALES - 1;
  // The hill narrows as it rises.
  const span = 1 - 0.06 * (i + 1);
  return {
    kind: "bancal" as const,
    level: 28 + (i + 1) * BANCAL_RISE,
    planting: top ? ("pine" as const) : i % 2 === 0 ? ("vine" as const) : ("olive" as const),
    outline: band(upper, lower, WEST_END * span, EAST_END * span),
  };
});

const seaWall = wandering(SEA_WALL, 2.5, 4);
const promenadeTop = wandering(SEA_WALL + PROMENADE, 2.5, 4);
const shore = wandering(SEA_WALL + PROMENADE + BEACH, 6, 5.5);
const roadBand = (radius: number) =>
  [circle(radius - ROAD_HALF), circle(radius + ROAD_HALF)] as const;

export const sitePlan: SitePlan = sitePlanSchema.parse({
  terraces: [
    ...bancales.toReversed(),
    {
      kind: "row",
      level: 28,
      planting: "garden",
      outline: band(
        wandering(OLIVO_BACK, 3, 1),
        circle(THIRD.radius - ROAD_HALF),
        WEST_END,
        EAST_END,
      ),
    },
    {
      kind: "road",
      level: THIRD.level,
      outline: band(...roadBand(THIRD.radius), WEST_BEND, THIRD_END),
    },
    {
      kind: "bancal",
      level: 21,
      planting: "olive",
      outline: band(circle(THIRD.radius + ROAD_HALF), circle(PINAR_BACK), WEST_BEND, EAST_END),
    },
    {
      kind: "row",
      level: 18,
      planting: "garden",
      outline: band(circle(PINAR_BACK), circle(SECOND.radius - ROAD_HALF), WEST_BEND, EAST_END),
    },
    {
      kind: "road",
      level: SECOND.level,
      outline: band(...roadBand(SECOND.radius), WEST_BEND, EAST_BEND),
    },
    {
      kind: "bancal",
      level: 11,
      planting: "vine",
      outline: band(
        circle(SECOND.radius + ROAD_HALF),
        circle(FIRST.radius - ROAD_HALF),
        WEST_END,
        EAST_BEND,
      ),
    },
    {
      kind: "road",
      level: FIRST.level,
      outline: band(...roadBand(FIRST.radius), WEST_END, EAST_BEND),
    },
    {
      kind: "row",
      level: 4,
      planting: "garden",
      outline: band(circle(DUNA_FRONT), seaWall, WEST_END, EAST_END),
    },
    { kind: "promenade", level: 1.5, outline: band(seaWall, promenadeTop, WEST_END, EAST_END) },
    { kind: "beach", level: 0, outline: band(promenadeTop, shore, WEST_END, EAST_END) },
  ],
  shoreline: along(shore, WEST_END, EAST_END).map(roundPoint),
  road: {
    centre: [
      ...stretch(FIRST.radius, FIRST.level, WEST_END, EAST_BEND),
      ...hairpin(FIRST, SECOND, EAST_BEND, 1).slice(1, -1),
      ...stretch(SECOND.radius, SECOND.level, EAST_BEND, WEST_BEND),
      ...hairpin(SECOND, THIRD, WEST_BEND, -1).slice(1, -1),
      ...stretch(THIRD.radius, THIRD.level, WEST_BEND, THIRD_END),
    ].map(({ x, z, y }) => ({ x: round(x), z: round(z), y: round(y) })),
    width: ROAD_WIDTH,
  },
  plots,
  zones: [
    zoneAround("villa-duna-blanca", "Primera línea", plots),
    zoneAround("casa-pinar", "Casa Pinar", plots),
    zoneAround("casa-olivo", "Casa Olivo", plots),
  ],
});

const problems = validateSitePlan(sitePlan, sitePlans);
if (problems.length > 0) throw new Error(`The site plan is wrong:\n${problems.join("\n")}`);
