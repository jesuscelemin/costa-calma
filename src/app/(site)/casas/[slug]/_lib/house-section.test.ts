import { describe, expect, test } from "vitest";

import { villaMarPlan } from "@/features/houses/plans/villa-mar";

import { houseSection } from "./house-section";

// Villa Mar cut north–south at x = −4,3: through the guest bedroom and the living room on the
// ground floor, the second bedroom, the double height and the third bedroom above, the roof's herb
// garden and solarium, and the porch and the pool. Positions along the cut are z, north to south.
const section = houseSection(villaMarPlan)!;

describe("Villa Mar's section", () => {
  test("cuts through the rooms of every floor, from north to south", () => {
    expect(section.rooms.map(({ floor, id, from, to }) => [floor, id, from, to])).toEqual([
      ["plot", "porche", 5, 8],
      ["plot", "piscina", 8.5, 12],
      ["ground", "dormitorio-invitados", -5, -1],
      ["ground", "salon", -1, 5],
      ["first", "dormitorio-2", -5, -1],
      ["first", "dormitorio-3", 3.4, 8],
      ["roof", "aromaticas", -5, -1],
      ["roof", "solarium", -1, 8],
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
      // The guest bedroom's north window, its wall onto the living room, the sliding door onto the
      // porch.
      ["ground", -5, "exterior", 0.24, { kind: "window", sill: 0.9, head: 2.2 }],
      ["ground", -1, "interior", 0.1, undefined],
      ["ground", 5, "exterior", 0.24, { kind: "sliding", sill: 0, head: 2.4 }],
      // The second bedroom's north window, the double height between walls, the third bedroom's
      // low window to the sea at the tip of the overhang.
      ["first", -5, "exterior", 0.24, { kind: "window", sill: 0.9, head: 2.2 }],
      ["first", -1, "interior", 0.1, undefined],
      ["first", 3.4, "interior", 0.1, undefined],
      ["first", 8, "exterior", 0.24, { kind: "window", sill: 0.4, head: 2.2 }],
      // The roof's railings at either end.
      ["roof", -5, "railing", 0.04, undefined],
      ["roof", 8, "railing", 0.04, undefined],
    ]);
  });

  test("stands its floors 3,20 m apart, up to the roof at +6,40", () => {
    expect(section.levels).toEqual([
      { floor: "ground", name: "Planta baja", y: 0, label: "+0,00" },
      { floor: "first", name: "Primera planta", y: 3.2, label: "+3,20" },
      { floor: "roof", name: "Azotea", y: 6.4, label: "+6,40" },
    ]);
  });

  test("leaves the first floor's slab open over the living room, which rises 6,4 m", () => {
    expect(section.slabs.map(({ floor, from, to }) => [floor, from, to])).toEqual([
      ["ground", -5, 5],
      ["first", -5, -1],
      ["first", 3.4, 8],
      ["roof", -5, 8],
    ]);
    expect(section.doubleHeights).toEqual([
      { floor: "ground", room: "salon", from: -1, to: 3.4, y: 0, height: 6.4 },
    ]);
  });

  test("flies the first floor 3 m past the ground floor, over the porch", () => {
    expect(section.overhangs).toEqual([{ floor: "first", from: 5, to: 8, over: ["porche"] }]);
  });

  test("stands on the plot's land, with the pool sunk into it at the end of the garden", () => {
    expect(section.terrain).toEqual({ from: -9, to: 12, depth: 1.6 });
    // 1,4 m deep, its water 12 cm under its edge, and its walls 15 cm thick.
    expect(section.pool).toEqual({ from: 8.5, to: 12, depth: 1.4, water: -0.12, rim: 0.15 });
  });

  test("dimensions the house along the cut from wall to wall: 13 m from the north wall to the sea", () => {
    // The bedrooms' north wall, the living room's, the third bedroom's, the porch's sliding door,
    // the tip of the overhang.
    expect(section.dimensions).toEqual([-5, -1, 3.4, 5, 8]);
  });
});
