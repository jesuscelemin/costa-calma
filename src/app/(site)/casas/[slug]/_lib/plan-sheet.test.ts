import { describe, expect, test } from "vitest";

import { villaMarPlan } from "@/features/houses/plans/villa-mar";

import { dimension, planSheet, sheetWorldBounds, type SheetMark } from "./plan-sheet";

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
