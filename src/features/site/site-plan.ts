import type { HousePlan, Side } from "../houses/schema.ts";
import type { SitePlan, SitePlot, SitePoint } from "./schema.ts";

// Geometry of the site plan: where each plot's plan lands on the site, and the rules the layout
// keeps (no plot over another or over the road, the semi-detached pairs together, every front door
// onto the road, every plot in its zone). Plans are looked up by house type slug.

export type PlansBySlug = Readonly<Record<string, HousePlan>>;

const EPSILON = 0.05;

/** A point of a plot's plan, in the plan's own metres, placed on the site. */
export function toSite(plot: SitePlot, plan: HousePlan, point: SitePoint): SitePoint {
  const { x, z, w, d } = plan.plot;
  let dx = point.x - (x + w / 2);
  const dz = point.z - (z + d / 2);
  if (plot.mirrored) dx = -dx;
  const angle = (plot.rotation * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { x: plot.x + dx * cos - dz * sin, z: plot.z + dx * sin + dz * cos };
}

/** The plot's corners on the site: its plan's north-west, north-east, south-east and south-west. */
export function plotCorners(plot: SitePlot, plan: HousePlan): SitePoint[] {
  const { x, z, w, d } = plan.plot;
  return [
    { x, z },
    { x: x + w, z },
    { x: x + w, z: z + d },
    { x, z: z + d },
  ].map((corner) => toSite(plot, plan, corner));
}

/**
 * The plot's edge on one side of its plan, as two points on the site. The side is the plan's own:
 * on a mirrored plot, its west edge lands on the east.
 */
export function plotEdge(plot: SitePlot, plan: HousePlan, side: Side): [SitePoint, SitePoint] {
  const [nw, ne, se, sw] = plotCorners(plot, plan) as [SitePoint, SitePoint, SitePoint, SitePoint];
  const edges: Record<Side, [SitePoint, SitePoint]> = {
    north: [nw, ne],
    south: [sw, se],
    east: [ne, se],
    west: [nw, sw],
  };
  return edges[side];
}

/** The side of its plan the front door opens on. */
export function entranceSide(plan: HousePlan): Side | undefined {
  for (const floor of plan.floors) {
    const entrance = floor.openings.find(({ kind }) => kind === "entrance");
    if (entrance) return entrance.side;
  }
  return undefined;
}

const midpoint = ([a, b]: [SitePoint, SitePoint]): SitePoint => ({
  x: (a.x + b.x) / 2,
  z: (a.z + b.z) / 2,
});

/** Distance from a point to the nearest road's centre line. */
export function distanceToRoads(point: SitePoint, site: Pick<SitePlan, "roads">): number {
  return Math.min(...site.roads.map(({ centre }) => distanceToLine(point, centre)));
}

/** Distance from a point to a polyline. */
export function distanceToLine(point: SitePoint, line: SitePoint[]): number {
  let best = Infinity;
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i] as SitePoint;
    const b = line[i + 1] as SitePoint;
    const abx = b.x - a.x;
    const abz = b.z - a.z;
    const t = Math.max(
      0,
      Math.min(1, ((point.x - a.x) * abx + (point.z - a.z) * abz) / (abx * abx + abz * abz)),
    );
    best = Math.min(best, Math.hypot(point.x - (a.x + t * abx), point.z - (a.z + t * abz)));
  }
  return best;
}

/** Whether a point lies inside a closed polygon (on its edge counts as inside). */
export function insidePolygon(point: SitePoint, polygon: SitePoint[]): boolean {
  const closed = [...polygon, polygon[0] as SitePoint];
  if (distanceToLine(point, closed) < EPSILON) return true;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i] as SitePoint;
    const b = polygon[j] as SitePoint;
    if (a.z > point.z !== b.z > point.z) {
      const x = ((b.x - a.x) * (point.z - a.z)) / (b.z - a.z) + a.x;
      if (point.x < x) inside = !inside;
    }
  }
  return inside;
}

/** Whether two convex quadrilaterals overlap by more than a touch (separating axis test). */
export function overlap(a: SitePoint[], b: SitePoint[]): boolean {
  for (const polygon of [a, b]) {
    for (let i = 0; i < polygon.length; i++) {
      const p = polygon[i] as SitePoint;
      const q = polygon[(i + 1) % polygon.length] as SitePoint;
      const length = Math.hypot(q.x - p.x, q.z - p.z);
      const nx = -(q.z - p.z) / length;
      const nz = (q.x - p.x) / length;
      const project = (points: SitePoint[]) => points.map(({ x, z }) => x * nx + z * nz);
      const pa = project(a);
      const pb = project(b);
      if (
        Math.max(...pa) <= Math.min(...pb) + EPSILON ||
        Math.max(...pb) <= Math.min(...pa) + EPSILON
      ) {
        return false;
      }
    }
  }
  return true;
}

/** Everything wrong with a site plan, in English, for the tests and the schema. */
export function validateSitePlan(site: SitePlan, plans: PlansBySlug): string[] {
  const problems: string[] = [];
  const placed: { plot: SitePlot; plan: HousePlan; corners: SitePoint[] }[] = [];

  site.plots.forEach((plot, index) => {
    if (site.plots.findIndex(({ unit }) => unit === plot.unit) !== index) {
      problems.push(`Unit ${plot.unit} has more than one plot`);
    }
    const plan = plans[plot.houseType];
    if (!plan) {
      problems.push(`Unit ${plot.unit} has an unknown house type "${plot.houseType}"`);
      return;
    }
    placed.push({ plot, plan, corners: plotCorners(plot, plan) });
  });

  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      const a = placed[i]!;
      const b = placed[j]!;
      if (overlap(a.corners, b.corners)) {
        problems.push(`The plots of units ${a.plot.unit} and ${b.plot.unit} overlap`);
      }
    }
  }

  for (const { plot, plan, corners } of placed) {
    const { unit } = plot;
    const clearance = Math.max(...site.roads.map(({ width }) => width)) / 2;
    // The plot's edges, sampled, must keep off the road.
    const edgePoints = corners.flatMap((corner, i) => {
      const next = corners[(i + 1) % corners.length] as SitePoint;
      return [0, 0.25, 0.5, 0.75].map((t) => ({
        x: corner.x + (next.x - corner.x) * t,
        z: corner.z + (next.z - corner.z) * t,
      }));
    });
    if (edgePoints.some((point) => distanceToRoads(point, site) < clearance - EPSILON)) {
      problems.push(`The plot of unit ${unit} is on the road`);
    }

    const terraces = site.terraces.filter(({ outline }) =>
      corners.every((corner) => insidePolygon(corner, outline)),
    );
    if (terraces.length === 0) problems.push(`The plot of unit ${unit} is not on a terrace`);

    if (plan.partyWall) {
      const wall = midpoint(plotEdge(plot, plan, plan.partyWall));
      const neighbour = placed.find(
        (other) =>
          other.plot !== plot &&
          other.plan.partyWall &&
          Math.hypot(
            midpoint(plotEdge(other.plot, other.plan, other.plan.partyWall)).x - wall.x,
            midpoint(plotEdge(other.plot, other.plan, other.plan.partyWall)).z - wall.z,
          ) <
            EPSILON * 4,
      );
      if (!neighbour) problems.push(`The party wall of unit ${unit} stands alone`);
    }

    const entrance = entranceSide(plan);
    if (entrance) {
      const opposite = ({ north: "south", south: "north", east: "west", west: "east" } as const)[
        entrance
      ];
      const front = distanceToRoads(midpoint(plotEdge(plot, plan, entrance)), site);
      const back = distanceToRoads(midpoint(plotEdge(plot, plan, opposite)), site);
      if (front >= back) problems.push(`The front door of unit ${unit} turns its back to the road`);
    }

    const zone = site.zones.find(({ houseType }) => houseType === plot.houseType);
    if (!zone) {
      problems.push(`Unit ${unit} has no zone for "${plot.houseType}"`);
    } else if (!corners.every((corner) => insidePolygon(corner, zone.outline))) {
      problems.push(`The plot of unit ${unit} is not inside its zone`);
    }
    for (const other of site.zones) {
      if (other !== zone && corners.some((corner) => insidePolygon(corner, other.outline))) {
        problems.push(`The plot of unit ${unit} reaches into the zone of "${other.houseType}"`);
      }
    }
  }

  site.zones.forEach((zone, index) => {
    if (site.zones.findIndex(({ houseType }) => houseType === zone.houseType) !== index) {
      problems.push(`"${zone.houseType}" has more than one zone`);
    }
  });

  return problems;
}
