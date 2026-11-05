import { describe, expect, test } from "vitest";

import { villaMarPlan } from "@/features/houses/plans/villa-mar";

import { formatArea } from "@/lib/format";

import { floorViews } from "./floor-views";
import {
  dimension,
  floorAnnotations,
  planSheet,
  sheetWorldBounds,
  type SheetMark,
} from "./plan-sheet";

const plan = villaMarPlan;
const [ground, first] = plan.floors.filter(({ kind }) => kind !== "plot");
const sheet = planSheet(plan, ground!, "Villa Mar");
const texts = (marks: SheetMark[]) =>
  marks.flatMap((mark) => (mark.kind === "text" ? [mark.text] : []));

describe("the ground floor's sheet", () => {
  test("names each room in capitals, with its m² and sizes under it", () => {
    const all = texts(sheet.marks);
    expect(all).toContain("SALÓN");
    expect(all).toContain("42\u00a0m² · 7,00 × 6,00");
    expect(all).toContain("RECIBIDOR");
    expect(all).toContain("PISCINA");
  });

  test("has its grid of axes, lettered across and numbered down, with their dimensions", () => {
    const all = texts(sheet.marks);
    for (const axis of ["A", "B", "C", "1", "2", "3"]) expect(all).toContain(axis);
    // Villa Mar's ground floor runs 18 m east to west: the whole chain.
    expect(all).toContain(dimension(18));
  });

  test("has its title block, its scale bar and the north", () => {
    const all = texts(sheet.marks);
    expect(all).toContain("PLANTA BAJA");
    expect(all.some((text) => text.startsWith("VILLA MAR  ·  COSTA CALMA"))).toBe(true);
    expect(all).toContain("5 m");
    expect(all).toContain("N");
  });

  test("draws the doors' swings and the furniture", () => {
    // The front door, the utility room's, the toilet's and the study's.
    expect(sheet.marks.filter(({ kind }) => kind === "arc")).toHaveLength(4);
    expect(sheet.marks.filter(({ kind }) => kind === "shape").length).toBeGreaterThan(30);
  });

  test("covers the whole plot and its margins", () => {
    const bounds = sheetWorldBounds(sheet);
    expect(bounds.x).toBeLessThan(plan.plot.x);
    expect(bounds.z).toBeLessThan(plan.plot.z);
    expect(bounds.x + bounds.w).toBeGreaterThan(plan.plot.x + plan.plot.w);
    expect(bounds.z + bounds.d).toBeGreaterThan(plan.plot.z + plan.plot.d);
  });
});

describe("a floor above", () => {
  test("names its rooms and draws their furniture, without the sheet's grid or title", () => {
    const all = texts(planSheet(plan, first!, "Villa Mar").marks);
    expect(all).toContain("SUITE PRINCIPAL");
    expect(all).not.toContain("PLANTA BAJA");
    expect(all).not.toContain("A");
  });
});

describe("a floor picked from the whole house", () => {
  const views = floorViews(plan).floors;
  const storeys = plan.floors.filter(({ kind }) => kind !== "plot");

  test("names every room as its 2D plan does, with the same m² and its sizes", () => {
    for (const floor of storeys) {
      const all = texts(planSheet(plan, floor, "Villa Mar").marks);
      const view = views.find(({ id }) => id === floor.id)!;
      for (const room of view.geometry.rooms) {
        if (room.kind === "void" || room.kind === "stair") continue;
        expect(all, `${floor.id}/${room.id}`).toContain(room.name.toLocaleUpperCase("es-ES"));
        expect(all, `${floor.id}/${room.id}`).toContain(
          `${formatArea(room.area)} · ${dimension(room.w)} × ${dimension(room.d)}`,
        );
      }
    }
  });

  test("has its own axes, dimensions, north and title over its floor", () => {
    // The first floor runs from the stair to the suite's terrace; the roof over the house.
    for (const floor of [...storeys, plan.floors.find(({ kind }) => kind === "plot")!]) {
      const all = texts(floorAnnotations(plan, floor, "Villa Mar").marks);
      expect(all, floor.id).toContain(floor.name.toLocaleUpperCase("es-ES"));
      // Exterior's north is the ground floor's sheet's, under it.
      if (floor.kind !== "plot") expect(all, floor.id).toContain("N");
      expect(all, floor.id).toContain("A");
      expect(all, floor.id).toContain("1");
    }
    const first = storeys[1]!;
    const rooms = views.find(({ id }) => id === first.id)!.geometry.rooms;
    const width =
      Math.max(...rooms.map(({ x, w }) => x + w)) - Math.min(...rooms.map(({ x }) => x));
    expect(texts(floorAnnotations(plan, first, "Villa Mar").marks)).toContain(dimension(width));
    // Exterior: the plot whole, 1.200 m² of it.
    const plot = plan.floors.find(({ kind }) => kind === "plot")!;
    expect(texts(floorAnnotations(plan, plot, "Villa Mar").marks)).toContain(
      dimension(plan.plot.w),
    );
  });
});
