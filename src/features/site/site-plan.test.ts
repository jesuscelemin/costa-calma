import { describe, expect, test } from "vitest";

import { catalogData } from "../houses/data";
import { sitePlan, sitePlans } from "./data";
import type { SitePlan, SitePlot } from "./schema";
import {
  distanceToLine,
  entranceSide,
  overlap,
  plotCorners,
  toSite,
  validateSitePlan,
} from "./site-plan";

const plot = (unit: number): SitePlot => {
  const found = sitePlan.plots.find((candidate) => candidate.unit === unit);
  if (!found) throw new Error(`No plot for unit ${unit}`);
  return found;
};

/** The site plan with one plot changed. */
const withPlot = (unit: number, change: Partial<SitePlot>): SitePlan => ({
  ...sitePlan,
  plots: sitePlan.plots.map((candidate) =>
    candidate.unit === unit ? { ...candidate, ...change } : candidate,
  ),
});

describe("Costa Calma's site plan", () => {
  test("keeps every rule", () => {
    expect(validateSitePlan(sitePlan, sitePlans)).toEqual([]);
  });

  test("has a plot for each of the catalogue's units, of the same house type", () => {
    const plots = sitePlan.plots.map(({ unit, houseType }) => ({ unit, houseType }));
    const units = catalogData.units.map(({ number, houseType }) => ({ unit: number, houseType }));
    expect(plots.toSorted((a, b) => a.unit - b.unit)).toEqual(
      units.toSorted((a, b) => a.unit - b.unit),
    );
  });

  test("climbs from the sea: Villa Duna Blanca, then Casa Olivo, then Casa Pinar", () => {
    const zs = (units: number[]) => units.map((unit) => plot(unit).z);
    const duna = zs([1, 2, 3, 4]);
    const olivo = zs([11, 12, 13, 14, 15, 16]);
    const pinar = zs([5, 6, 7, 8, 9, 10]);
    expect(Math.min(...duna)).toBeGreaterThan(Math.max(...olivo));
    expect(Math.min(...olivo)).toBeGreaterThan(Math.max(...pinar));
  });

  test("joins every street to the collector road, and the middle and top ones round the west", () => {
    const road = (id: string) => sitePlan.roads.find((candidate) => candidate.id === id)!;
    const collector = road("collector").centre;
    for (const id of ["coast", "middle", "top"]) {
      expect(distanceToLine(road(id).centre.at(-1)!, collector)).toBeLessThan(0.5);
    }
    const bend = road("west-bend").centre;
    expect(distanceToLine(bend[0]!, road("top").centre)).toBeLessThan(0.5);
    expect(distanceToLine(bend.at(-1)!, road("middle").centre)).toBeLessThan(0.5);
    const ys = collector.map(({ y }) => y);
    expect(ys).toEqual(ys.toSorted((a, b) => a - b));
  });

  test("sets the development among its neighbours, none on a road or on the development", () => {
    expect(sitePlan.neighbours.length).toBeGreaterThan(30);
    expect(sitePlan.neighbours.some(({ kind }) => kind === "apartments")).toBe(true);
  });

  test("numbers each row west to east", () => {
    const xs = (units: number[]) => units.map((unit) => plot(unit).x);
    const sorted = (values: number[]) => values.toSorted((a, b) => a - b);
    expect(xs([1, 2, 3, 4])).toEqual(sorted(xs([1, 2, 3, 4])));
    expect(xs([5, 6, 7, 8, 9, 10])).toEqual(sorted(xs([5, 6, 7, 8, 9, 10])));
    expect(xs([11, 12, 13, 14, 15, 16])).toEqual(sorted(xs([11, 12, 13, 14, 15, 16])));
  });

  test("has a zone for each house type", () => {
    expect(sitePlan.zones.map(({ houseType }) => houseType).toSorted()).toEqual(
      catalogData.houseTypes.map(({ slug }) => slug).toSorted(),
    );
  });
});

describe("placing a plan on the site", () => {
  const plan = sitePlans["villa-duna-blanca"]!;

  test("keeps the plot's size", () => {
    const [nw, ne, , sw] = plotCorners(plot(2), plan);
    expect(Math.hypot(ne!.x - nw!.x, ne!.z - nw!.z)).toBeCloseTo(plan.plot.w);
    expect(Math.hypot(sw!.x - nw!.x, sw!.z - nw!.z)).toBeCloseTo(plan.plot.d);
  });

  test("puts the plan's centre on the plot's", () => {
    const centre = { x: plan.plot.x + plan.plot.w / 2, z: plan.plot.z + plan.plot.d / 2 };
    expect(toSite(plot(3), plan, centre)).toEqual({ x: plot(3).x, z: plot(3).z });
  });

  test("turns clockwise, seen from above", () => {
    const north = { x: plan.plot.w / 2, z: 0 };
    const turned = toSite({ ...plot(1), x: 0, z: 0, rotation: 90 }, plan, north);
    expect(turned.x).toBeCloseTo(plan.plot.d / 2);
    expect(turned.z).toBeCloseTo(0);
  });

  test("mirrors east for west", () => {
    const west = { x: 0, z: plan.plot.d / 2 };
    const mirrored = toSite({ ...plot(1), x: 0, z: 0, rotation: 0, mirrored: true }, plan, west);
    expect(mirrored.x).toBeCloseTo(plan.plot.w / 2);
  });

  test("finds the side of the front door", () => {
    expect(entranceSide(plan)).toBe("north");
    expect(entranceSide(sitePlans["casa-pinar"]!)).toBe("south");
  });

  test("tells touching plots from overlapping ones", () => {
    const square = (x: number) => [
      { x, z: 0 },
      { x: x + 1, z: 0 },
      { x: x + 1, z: 1 },
      { x, z: 1 },
    ];
    expect(overlap(square(0), square(1))).toBe(false);
    expect(overlap(square(0), square(0.5))).toBe(true);
  });
});

describe("a site plan that breaks a rule", () => {
  test("has two plots over each other", () => {
    expect(validateSitePlan(withPlot(2, { x: plot(1).x + 5 }), sitePlans)).toContain(
      "The plots of units 1 and 2 overlap",
    );
  });

  test("has a plot on the road", () => {
    expect(validateSitePlan(withPlot(2, { z: plot(2).z - 15 }), sitePlans)).toContain(
      "The plot of unit 2 is on the road",
    );
  });

  test("has a plot off every terrace", () => {
    expect(validateSitePlan(withPlot(2, { z: plot(2).z + 60 }), sitePlans)).toContain(
      "The plot of unit 2 is not on a terrace",
    );
  });

  test("leaves a semi-detached half without its pair", () => {
    expect(validateSitePlan(withPlot(6, { x: plot(6).x + 1 }), sitePlans)).toContain(
      "The party wall of unit 5 stands alone",
    );
  });

  test("turns a front door away from the road", () => {
    expect(
      validateSitePlan(withPlot(3, { rotation: plot(3).rotation + 180 }), sitePlans),
    ).toContain("The front door of unit 3 turns its back to the road");
  });

  test("puts a plot outside its zone", () => {
    const zones = sitePlan.zones.map((zone) =>
      zone.houseType === "casa-olivo"
        ? { ...zone, outline: zone.outline.map(({ x, z }) => ({ x: x + 40, z })) }
        : zone,
    );
    expect(validateSitePlan({ ...sitePlan, zones }, sitePlans)).toContain(
      "The plot of unit 11 is not inside its zone",
    );
  });

  test("gives a unit two plots", () => {
    expect(validateSitePlan(withPlot(2, { unit: 1 }), sitePlans)).toContain(
      "Unit 1 has more than one plot",
    );
  });

  test("names an unknown house type", () => {
    expect(validateSitePlan(withPlot(2, { houseType: "casa-mar" }), sitePlans)).toContain(
      'Unit 2 has an unknown house type "casa-mar"',
    );
  });
});
