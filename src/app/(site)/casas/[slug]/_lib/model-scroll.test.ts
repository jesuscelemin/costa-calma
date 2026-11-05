import { describe, expect, test } from "vitest";

import { villaMarPlan } from "@/features/houses/plans/villa-mar";

import { modelAt, scrollMarks } from "./model-choreography";
import { phaseOf, stopMiddle, stopOf } from "./model-scroll";
import { tourStops } from "./tour";

const plan = villaMarPlan;
// What the page is given, as it reaches the client: through JSON, without the plan.
const marks = JSON.parse(JSON.stringify(scrollMarks(plan))) as ReturnType<typeof scrollMarks>;
const samples = Array.from({ length: 4001 }, (_, i) => i / 4000);

describe("the stretch's marks, which the page scrolls by without the scene", () => {
  test("put every point of the scroll in the scene's phase", () => {
    for (const p of samples) expect(phaseOf(p, marks), `${p}`).toBe(modelAt(p, plan).phase);
  });

  test("put every point of the scroll at the scene's stop, moving or still", () => {
    for (const still of [false, true]) {
      for (const p of samples) {
        expect(stopOf(p, marks, { still }), `${p} ${still}`).toBe(modelAt(p, plan, { still }).stop);
      }
    }
  });

  test("take each stop's controls to where the scene holds at it", () => {
    tourStops(plan).forEach((_, i) => {
      expect(modelAt(stopMiddle(i, marks), plan).stop).toBe(i);
      expect(modelAt(stopMiddle(i, marks), plan, { still: true }).stop).toBe(i);
    });
  });
});
