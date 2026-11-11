import { describe, expect, it } from "vitest";

import { blindDelay, countUpAt, easeCalmAt, scrollThrough, wordTint } from "./reveal";

describe("easeCalmAt", () => {
  it("starts at 0, ends at 1 and runs ahead of linear, as an ease-out does", () => {
    expect(easeCalmAt(0)).toBe(0);
    expect(easeCalmAt(1)).toBe(1);
    expect(easeCalmAt(0.25)).toBeGreaterThan(0.5);
  });

  it("never goes back", () => {
    let last = 0;
    for (let t = 0; t <= 1; t += 0.05) {
      const value = easeCalmAt(t);
      expect(value).toBeGreaterThanOrEqual(last - 1e-9);
      last = value;
    }
  });

  it("clamps progress outside 0–1", () => {
    expect(easeCalmAt(-1)).toBe(0);
    expect(easeCalmAt(2)).toBe(1);
  });
});

describe("countUpAt", () => {
  it("counts from 0 to the target and holds it", () => {
    expect(countUpAt(448, 0, 1000)).toBe(0);
    expect(countUpAt(448, 1000, 1000)).toBe(448);
    expect(countUpAt(448, 5000, 1000)).toBe(448);
  });

  it("shows whole numbers for a whole target and the target's decimals otherwise", () => {
    expect(Number.isInteger(countUpAt(1008, 300, 1000))).toBe(true);
    const value = countUpAt(31.5, 300, 1000);
    expect(Math.round(value * 10)).toBe(value * 10);
  });

  it("never passes the target on the way", () => {
    for (let t = 0; t <= 1000; t += 50) expect(countUpAt(4, t, 1000)).toBeLessThanOrEqual(4);
  });

  it("shows the target at once without a duration", () => {
    expect(countUpAt(3, 0, 0)).toBe(3);
  });
});

describe("blindDelay", () => {
  it("opens the blinds in order, one stagger apart", () => {
    expect([0, 1, 2, 3].map((index) => blindDelay(index, 100))).toEqual([0, 100, 200, 300]);
  });
});

describe("wordTint", () => {
  it("is all muted at the start and all ink at the end", () => {
    expect([0, 1, 2].map((index) => wordTint(0, index, 3))).toEqual([0, 0, 0]);
    expect([0, 1, 2].map((index) => wordTint(1, index, 3))).toEqual([1, 1, 1]);
  });

  it("tints the words one after another", () => {
    expect([0, 1, 2, 3].map((index) => wordTint(0.375, index, 4))).toEqual([1, 0.5, 0, 0]);
  });
});

describe("scrollThrough", () => {
  it("is 0 below the start line and 1 once the bottom reaches the end line", () => {
    expect(scrollThrough({ top: 900, height: 200 }, 1000)).toBe(0);
    expect(scrollThrough({ top: 300, height: 200 }, 1000)).toBe(1);
  });

  it("is halfway between them", () => {
    // From top 850 to top 300: halfway is 575.
    expect(scrollThrough({ top: 575, height: 200 }, 1000)).toBeCloseTo(0.5);
  });
});
