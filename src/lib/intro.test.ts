import { describe, expect, test } from "vitest";

import { introLiftAt } from "./intro";

// The spec's bounds: at least 1.2 s so the sun is seen rising, at most 2.5 s of waiting.
describe("when the intro lifts", () => {
  test("waits for the preload when it lands between the minimum and the maximum", () => {
    expect(introLiftAt(1800)).toBe(1800);
  });

  test("stays the minimum when the preload is quicker", () => {
    expect(introLiftAt(0)).toBe(1200);
    expect(introLiftAt(400)).toBe(1200);
  });

  test("never waits past the maximum, however slow the preload", () => {
    expect(introLiftAt(2500)).toBe(2500);
    expect(introLiftAt(9000)).toBe(2500);
    expect(introLiftAt(Infinity)).toBe(2500);
  });
});
