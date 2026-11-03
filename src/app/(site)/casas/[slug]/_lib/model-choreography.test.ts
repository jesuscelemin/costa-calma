import { describe, expect, test } from "vitest";

import { villaMarPlan } from "@/features/houses/plans/villa-mar";

import { modelAt, modelPhases, phaseBounds } from "./model-choreography";

const plan = villaMarPlan;

describe("the house model's choreography", () => {
  test("starts on the drawing, then opens the lens, and for now nothing more", () => {
    expect(modelPhases.map(({ id }) => id)).toEqual(["drawing", "lens"]);
    expect(modelAt(0, plan).phase).toBe("drawing");
    expect(modelAt(0.1, plan).phase).toBe("drawing");
    expect(modelAt(0.6, plan).phase).toBe("lens");
    expect(modelAt(1, plan).phase).toBe("lens");
  });

  test("the lens stays shut on the drawing, opens through its phase and holds open at the end", () => {
    const drawing = phaseBounds("drawing");
    for (const progress of [0, drawing.end / 2, drawing.end - 0.001]) {
      expect(modelAt(progress, plan).lens).toBe(0);
    }
    const lens = phaseBounds("lens");
    const halfway = modelAt((lens.start + lens.end) / 2, plan).lens;
    expect(halfway).toBeGreaterThan(0.2);
    expect(halfway).toBeLessThan(1);
    // The last stretch of the scroll holds the lens open, before the page moves on.
    expect(modelAt(0.9, plan).lens).toBe(1);
    expect(modelAt(1, plan).lens).toBe(1);
  });

  test("on the drawing, the camera looks square on at the cut, framed as the SVG", () => {
    expect(modelAt(0, plan).camera).toEqual({ yaw: 0, pitch: 0, distance: 1, depth: 0 });
    expect(modelAt(phaseBounds("drawing").end - 0.001, plan).camera).toEqual(
      modelAt(0, plan).camera,
    );
  });

  test("with the lens open, it turns off the cut and looks down into the house behind it", () => {
    const { yaw, pitch, depth } = modelAt(1, plan).camera;
    expect(Math.abs(yaw)).toBeGreaterThan(0.3);
    expect(pitch).toBeGreaterThan(0.2);
    // Villa Mar runs 10,3 m east of its cut, from x = −4,3 to 6: the camera turns about its middle.
    expect(depth).toBeCloseTo(5.15);
  });

  test("the lens only opens as the scroll goes forward, and shuts as it comes back", () => {
    const steps = Array.from({ length: 201 }, (_, i) => modelAt(i / 200, plan).lens);
    for (const [i, lens] of steps.entries()) {
      if (i > 0) expect(lens).toBeGreaterThanOrEqual(steps[i - 1]!);
    }
  });

  test("scroll outside the stretch keeps the first or the last state", () => {
    expect(modelAt(-0.5, plan)).toEqual(modelAt(0, plan));
    expect(modelAt(1.5, plan)).toEqual(modelAt(1, plan));
  });
});

describe("with reduced motion", () => {
  test("goes straight to each phase's destination, with nothing in between", () => {
    const lens = phaseBounds("lens");
    expect(modelAt(0.1, plan, { still: true })).toEqual(modelAt(0, plan));
    for (const progress of [lens.start, (lens.start + lens.end) / 2, 1]) {
      expect(modelAt(progress, plan, { still: true })).toEqual(modelAt(1, plan));
    }
  });
});
