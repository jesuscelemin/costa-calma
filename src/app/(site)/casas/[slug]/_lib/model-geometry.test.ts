import { describe, expect, test } from "vitest";

import { casaOlivoPlan } from "@/features/houses/plans/casa-olivo";
import { casaPinarPlan } from "@/features/houses/plans/casa-pinar";
import { villaMarPlan } from "@/features/houses/fixtures/villa-mar";

import { floorModel, plotModel, STOREY_HEIGHT } from "./model-geometry";

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

describe("a tree a courtyard declares", () => {
  test("Casa Olivo's olive tree stands in its courtyard, off the way to the garden", () => {
    // The courtyard: x from −2,5 to 2,5, z from −1,5 to 4,5.
    expect(plotModel(casaOlivoPlan).trees).toContainEqual({ x: -1.2, z: 2.6 });
  });

  test("Casa Pinar's pine stands in its entrance courtyard, clear of the way to the door", () => {
    // The courtyard: x from −2,5 to 3,5, z from −9 to −5; the front door at x = 0,4.
    expect(plotModel(casaPinarPlan).trees).toContainEqual({ x: 2.2, z: -7.4 });
  });
});
