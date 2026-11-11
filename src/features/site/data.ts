import { casaOlivoPlan } from "../houses/plans/casa-olivo.ts";
import { casaPinarPlan } from "../houses/plans/casa-pinar.ts";
import { villaDunaBlancaPlan } from "../houses/plans/villa-duna-blanca.ts";
import type { HousePlan } from "../houses/schema.ts";
import {
  sitePlanSchema,
  type SitePlan,
  type SitePlot,
  type SitePoint,
  type Zone,
} from "./schema.ts";
import { plotCorners, validateSitePlan, type PlansBySlug } from "./site-plan.ts";

// Costa Calma's site (ADR 0015), after Jesús's aerial view of the development
// (~/Desktop/Duna_Blanca/08_vista_urbanización.png): a hillside over a beach, terraced in three
// levels, and a road that curves along it between the two rows.
//
// The rows follow arcs round a centre far to the north, so the development bulges gently towards
// the sea and the road curves with it. From the sea up:
//
// - the beach, at 0 m, and a boardwalk promenade along its top, at +1,5 m;
// - the front row, at +4 m: the 4 Villa Duna Blanca (units 1–4, west to east), pools and gardens
//   to the sea, entered from the road behind them;
// - the road, at +8 m, with a verge either side;
// - the second row, at +12 m: the 2 semi-detached pairs of Casa Pinar (units 5–8) to the west and
//   the 4 Casa Olivo (units 9–12) to the east, entered from the road below them, pools behind.
//
// Each stone wall between two levels retains the higher one.

export const sitePlans: PlansBySlug = {
  "villa-duna-blanca": villaDunaBlancaPlan,
  "casa-pinar": casaPinarPlan,
  "casa-olivo": casaOlivoPlan,
};

/** Radius of the road's centre line, round the site's centre. */
const ROAD_RADIUS = 220;
/** The site's centre: the road's centre line passes through the origin, due south of it. */
const CENTRE: SitePoint = { x: 0, z: -ROAD_RADIUS };
const ROAD_WIDTH = 7;
/** Between the kerb and a plot's edge. */
const VERGE = 2;

const ROAD_NORTH = ROAD_RADIUS - ROAD_WIDTH / 2 - VERGE;
const ROAD_SOUTH = ROAD_RADIUS + ROAD_WIDTH / 2 + VERGE;
/** Front row's garden runs this far past its plots to the sea wall. */
const FRONT_GARDEN = 4;
const SEA_WALL = ROAD_SOUTH + 26.4 + FRONT_GARDEN;
const PROMENADE = 4;
const BEACH = 28;
const SHORE = SEA_WALL + PROMENADE + BEACH;
/** The second row's terrace runs this far up behind its plots. */
const HILL = 34;

/** The site's angular extent either side of due south, in radians. */
const SPAN = 0.62;

const atPolar = (radius: number, angle: number): SitePoint => ({
  x: CENTRE.x + radius * Math.sin(angle),
  z: CENTRE.z + radius * Math.cos(angle),
});

const polarOf = ({ x, z }: SitePoint) => ({
  radius: Math.hypot(x - CENTRE.x, z - CENTRE.z),
  angle: Math.atan2(x - CENTRE.x, z - CENTRE.z),
});

/** Points along an arc, from one angle to another. */
function arc(radius: number, from: number, to: number, step = 0.02): SitePoint[] {
  const count = Math.max(1, Math.ceil(Math.abs(to - from) / step));
  return Array.from({ length: count + 1 }, (_, i) =>
    atPolar(radius, from + ((to - from) * i) / count),
  );
}

/** A ring sector between two radii, as a closed outline. */
function band(inner: number, outer: number, from = -SPAN, to = SPAN): SitePoint[] {
  return [...arc(inner, from, to), ...arc(outer, to, from)];
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
  return { houseType, name, outline: band(inner, outer, from, to).map(roundPoint) };
}

const roundPoint = ({ x, z }: SitePoint): SitePoint => ({ x: round(x), z: round(z) });

const frontRow = row(
  [1, 2, 3, 4].map((unit) => ({ unit, houseType: "villa-duna-blanca", gapBefore: 6 })),
  ROAD_SOUTH,
  "outer",
);

const secondRow = row(
  [
    // Casa Pinar's plan has its party wall to the west: the western half of each pair is its mirror.
    { unit: 5, houseType: "casa-pinar", mirrored: true },
    { unit: 6, houseType: "casa-pinar", gapBefore: 0 },
    { unit: 7, houseType: "casa-pinar", mirrored: true, gapBefore: 8 },
    { unit: 8, houseType: "casa-pinar", gapBefore: 0 },
    { unit: 9, houseType: "casa-olivo", gapBefore: 10 },
    { unit: 10, houseType: "casa-olivo", gapBefore: 4 },
    { unit: 11, houseType: "casa-olivo", gapBefore: 4 },
    { unit: 12, houseType: "casa-olivo", gapBefore: 4 },
  ],
  ROAD_NORTH,
  "inner",
);

const plots = [...frontRow, ...secondRow];

export const sitePlan: SitePlan = sitePlanSchema.parse({
  terraces: [
    {
      id: "second-row",
      level: 12,
      outline: band(ROAD_NORTH - 26 - HILL, ROAD_NORTH).map(roundPoint),
    },
    { id: "road", level: 8, outline: band(ROAD_NORTH, ROAD_SOUTH).map(roundPoint) },
    { id: "front-row", level: 4, outline: band(ROAD_SOUTH, SEA_WALL).map(roundPoint) },
    { id: "promenade", level: 1.5, outline: band(SEA_WALL, SEA_WALL + PROMENADE).map(roundPoint) },
    { id: "beach", level: 0, outline: band(SEA_WALL + PROMENADE, SHORE).map(roundPoint) },
  ],
  shoreline: arc(SHORE, -SPAN, SPAN).map(roundPoint),
  road: { centre: arc(ROAD_RADIUS, -SPAN, SPAN).map(roundPoint), width: ROAD_WIDTH },
  plots,
  zones: [
    zoneAround("villa-duna-blanca", "Primera línea", plots),
    zoneAround("casa-pinar", "Casa Pinar", plots),
    zoneAround("casa-olivo", "Casa Olivo", plots),
  ],
});

const problems = validateSitePlan(sitePlan, sitePlans);
if (problems.length > 0) throw new Error(`The site plan is wrong:\n${problems.join("\n")}`);
