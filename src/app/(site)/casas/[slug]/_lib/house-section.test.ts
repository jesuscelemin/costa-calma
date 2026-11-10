import { describe, expect, test } from "vitest";

import { casaOlivoPlan } from "@/features/houses/plans/casa-olivo";
import { casaPinarPlan } from "@/features/houses/plans/casa-pinar";
import { villaMarPlan } from "@/features/houses/plans/villa-mar";

import { houseSection } from "./house-section";

// Villa Mar cut north–south at x = −6,5: through the living room on the ground floor, the suite's
// bathroom and the suite flying over the porch above, the roof's solarium, and the porch and the
// pool. Positions along the cut are z, north to south.
const section = houseSection(villaMarPlan)!;

describe("Villa Mar's section", () => {
  test("cuts through the rooms of every floor, from north to south", () => {
    expect(section.rooms.map(({ floor, id, from, to }) => [floor, id, from, to])).toEqual([
      ["plot", "porche", 5, 9],
      ["plot", "piscina", 9.8, 12.8],
      ["ground", "salon", -1, 5],
      ["first", "bano-suite", -1, 2.5],
      ["first", "suite", 2.5, 9],
      ["roof", "solarium", -1, 9],
    ]);
  });

  test("cuts the walls across it, with the openings it goes through", () => {
    expect(
      section.walls.map(({ floor, at, kind, thickness, opening }) => [
        floor,
        at,
        kind,
        thickness,
        opening && { kind: opening.kind, sill: opening.sill, head: opening.head },
      ]),
    ).toEqual([
      // The living room's glass to the entrance patio, and its sliding wall onto the porch.
      ["ground", -1, "exterior", 0.24, { kind: "window", sill: 0.1, head: 2.5 }],
      ["ground", 5, "exterior", 0.24, { kind: "sliding", sill: 0, head: 2.7 }],
      // The suite's bathroom, its wall onto the suite, and the suite's glass to the sea at the tip
      // of the overhang.
      ["first", -1, "exterior", 0.24, undefined],
      ["first", 2.5, "interior", 0.1, undefined],
      ["first", 9, "exterior", 0.24, { kind: "sliding", sill: 0, head: 2.7 }],
      // The roof's railings at either end.
      ["roof", -1, "railing", 0.04, undefined],
      ["roof", 9, "railing", 0.04, undefined],
    ]);
  });

  test("stands its floors 3,20 m apart, up to the roof at +6,40", () => {
    expect(section.levels).toEqual([
      { floor: "ground", name: "Planta baja", y: 0, label: "+0,00" },
      { floor: "first", name: "Primera planta", y: 3.2, label: "+3,20" },
      { floor: "roof", name: "Azotea", y: 6.4, label: "+6,40" },
    ]);
  });

  test("stacks its slabs whole, with no double height", () => {
    expect(section.slabs.map(({ floor, from, to }) => [floor, from, to])).toEqual([
      ["ground", -1, 5],
      ["first", -1, 9],
      ["roof", -1, 9],
    ]);
    expect(section.doubleHeights).toEqual([]);
  });

  test("flies the suite 4 m past the ground floor, over the porch", () => {
    expect(section.overhangs).toEqual([{ floor: "first", from: 5, to: 9, over: ["porche"] }]);
  });

  test("stands on the plot's land, with the pool sunk into it at the end of the garden", () => {
    expect(section.terrain).toEqual({ from: -10, to: 13, depth: 1.6 });
    // 1,4 m deep, its water 12 cm under its edge, and its walls 15 cm thick.
    expect(section.pool).toEqual({ from: 9.8, to: 12.8, depth: 1.4, water: -0.12, rim: 0.15 });
  });

  test("dimensions the house along the cut from wall to wall: 10 m from the patio to the sea", () => {
    // The living room's north wall, the suite's, the living room's sliding wall, the tip of the
    // overhang.
    expect(section.dimensions).toEqual([-1, 2.5, 5, 9]);
  });
});

// Casa Pinar cut north–south at x = 0: the courtyard, the hall, the landing and the living room
// below; the bathroom, the landing and the suite above, flying over the front door, and its
// terrace over the living room.
describe("Casa Pinar's section", () => {
  const pinar = houseSection(casaPinarPlan)!;

  test("cuts through the rooms of both floors, from north to south", () => {
    expect(pinar.rooms.map(({ floor, id, from, to }) => [floor, id, from, to])).toEqual([
      ["plot", "patio", -9, -5],
      ["plot", "porche", 4, 6.5],
      ["ground", "recibidor", -5, -2.6],
      ["ground", "distribuidor", -2.6, -1],
      ["ground", "salon", -1, 4],
      ["first", "bano", -7, -4.2],
      ["first", "distribuidor", -4.2, -1],
      ["first", "suite", -1, 2],
      ["first", "terraza", 2, 4],
    ]);
  });

  test("stands its two floors 3,20 m apart", () => {
    expect(pinar.levels.map(({ floor, label }) => [floor, label])).toEqual([
      ["ground", "+0,00"],
      ["first", "+3,20"],
    ]);
  });

  test("flies the first floor 2 m over the courtyard, sheltering the front door", () => {
    expect(pinar.overhangs).toEqual([{ floor: "first", from: -7, to: -5, over: ["patio"] }]);
  });
});

// Casa Olivo cut east–west at z = 1: the dining room, the olive tree's courtyard, the gallery and
// the third bedroom, its U seen from the sea.
describe("Casa Olivo's section", () => {
  const duna = houseSection(casaOlivoPlan)!;

  test("cuts across the courtyard, between its two wings", () => {
    expect(duna.rooms.map(({ floor, id, from, to }) => [floor, id, from, to])).toEqual([
      ["plot", "patio", -2.5, 2.5],
      ["ground", "comedor", -7.5, -2.5],
      ["ground", "galeria", 2.5, 3.9],
      ["ground", "dormitorio-3", 3.9, 8.5],
    ]);
  });

  test("has a single floor, and nothing flying", () => {
    expect(duna.levels.map(({ floor, label }) => [floor, label])).toEqual([["ground", "+0,00"]]);
    expect(duna.overhangs).toEqual([]);
  });
});
