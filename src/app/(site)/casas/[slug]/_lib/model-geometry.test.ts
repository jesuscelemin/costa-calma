import { describe, expect, test } from "vitest";

import { villaMarPlan } from "@/features/houses/plans/villa-mar";

import { floorModel, STOREY_HEIGHT } from "./model-geometry";

const plan = villaMarPlan;
const [ground, first, roof] = plan.floors.filter(({ kind }) => kind !== "plot");
const model = (floor: typeof ground, below?: typeof ground, next?: typeof ground) =>
  floorModel(plan, floor!, { below, next });

describe("Villa Mar's stair in the model", () => {
  // Its well: 2,2 × 5 m at x = 1, z = −6, entered from the south on every floor.
  test("climbs a storey in a U: 18 risers, a landing at the far end, inside its well", () => {
    const { stair } = model(ground, undefined, first);
    expect(stair).toHaveLength(9 + 1 + 9);
    const top = Math.max(...stair.map(({ y, h }) => y + h));
    expect(top).toBeCloseTo(STOREY_HEIGHT);
    for (const { x, z, w, d } of stair) {
      expect(x).toBeGreaterThanOrEqual(1 - 1e-9);
      expect(x + w).toBeLessThanOrEqual(3.2 + 1e-9);
      expect(z).toBeGreaterThanOrEqual(-6 - 1e-9);
      expect(z + d).toBeLessThanOrEqual(-1 + 1e-9);
    }
    // The landing, half a storey up, across the north end of the well, away from its entry.
    const landing = stair.find(({ w }) => w > 2);
    expect(landing).toMatchObject({ x: 1, w: 2.2, z: -6, d: 1 });
    expect(landing!.y + landing!.h).toBeCloseTo(STOREY_HEIGHT / 2);
  });

  test("leaves its well open in the slab of each floor it arrives at", () => {
    const inWell = ({ x, z }: { x: number; z: number }) => x === 1 && z === -6;
    expect(model(ground, undefined, first).slabs.some(inWell)).toBe(true);
    expect(model(first, ground, roof).slabs.some(inWell)).toBe(false);
    expect(model(roof, first).slabs.some(inWell)).toBe(false);
  });

  test("goes no higher than the top floor", () => {
    expect(model(first, ground, roof).stair).toHaveLength(19);
    expect(model(roof, first).stair).toHaveLength(0);
  });
});
