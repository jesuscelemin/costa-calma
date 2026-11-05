import { expect, test } from "vitest";

import { formatArea, formatPrice } from "./format";

// Spanish figures keep the number and its unit together with a no-break space.
const nbsp = " ";

test("prices use a dot for thousands and the euro sign after the figure", () => {
  expect(formatPrice(685000)).toBe(`685.000${nbsp}€`);
  expect(formatPrice(1250000)).toBe(`1.250.000${nbsp}€`);
});

test("four-digit figures are grouped too, unlike Spanish's default", () => {
  expect(formatPrice(9500)).toBe(`9.500${nbsp}€`);
});

test("areas are in square metres, with a decimal comma when they need one", () => {
  expect(formatArea(180)).toBe(`180${nbsp}m²`);
  expect(formatArea(31.5)).toBe(`31,5${nbsp}m²`);
  expect(formatArea(1462)).toBe(`1.462${nbsp}m²`);
});
