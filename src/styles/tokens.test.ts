import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

// Reads the real tokens, so a palette change that breaks contrast fails here.
const css = readFileSync(new URL("./tokens.css", import.meta.url), "utf8");

function declarations(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`No block for ${selector}`);
  const body = css.slice(start, css.indexOf("\n}", start));
  return Object.fromEntries(
    [...body.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()]),
  );
}

const dia = declarations(":root");
// Noche only overrides some tokens; the rest are shared with Día.
const nocheForced = declarations(':root[data-theme="dark"]');
const noche = { ...dia, ...nocheForced };
const themes = { Día: dia, Noche: noche };

type Rgb = [number, number, number];

function hexToRgb(hex: string): Rgb {
  const match = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex);
  if (!match) throw new Error(`Not a hex color: ${hex}`);
  return [
    Number.parseInt(match[1], 16),
    Number.parseInt(match[2], 16),
    Number.parseInt(match[3], 16),
  ];
}

// WCAG 2 relative luminance and contrast ratio.
function luminance([r, g, b]: Rgb): number {
  const [lr, lg, lb] = [r, g, b].map((channel) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

function contrast(a: Rgb, b: Rgb): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/** Paints `color` at `alpha` over `backdrop`, as the browser composites the scrim. */
function over(color: Rgb, alpha: number, backdrop: Rgb): Rgb {
  return color.map((channel, i) => Math.round(channel * alpha + backdrop[i] * (1 - alpha))) as Rgb;
}

const surfaces = ["surface", "surface-raised", "surface-sunken"];
const pairs = [
  ...["ink", "ink-muted", "mar", "accion"].flatMap((text) =>
    surfaces.map((surface) => [text, surface]),
  ),
  // Unit statuses are shown on cards (surface-raised).
  ...["olivo", "reservado", "vendido"].map((text) => [text, "surface-raised"]),
  // The action colour is ink (ADR 0014): the primary button's label sits on it, and hovered
  // controls show ink on accion-soft.
  ["on-accion", "accion"],
  ["ink", "accion-soft"],
];

describe.each(Object.entries(themes))("%s", (_, tokens) => {
  test.each(pairs)("%s on %s reaches 4.5:1", (text, surface) => {
    expect(contrast(hexToRgb(tokens[text]), hexToRgb(tokens[surface]))).toBeGreaterThanOrEqual(4.5);
  });
});

test("Noche is the same whether forced or from the system preference", () => {
  expect(declarations(':root:not([data-theme="light"])')).toEqual(nocheForced);
});

describe("text over media", () => {
  const white: Rgb = [255, 255, 255];

  // Text over media may only sit in the text zone, where the scrim is at its densest.
  const stops = [...dia.scrim.matchAll(/rgb\((\d+) (\d+) (\d+) \/ ([\d.]+)\) (\d+)%/g)].map(
    ([, r, g, b, alpha]) => ({
      color: [Number(r), Number(g), Number(b)] as Rgb,
      alpha: Number(alpha),
    }),
  );
  const densest = Math.max(...stops.map(({ alpha }) => alpha));
  const textZoneStops = stops.filter(({ alpha }) => alpha === densest);

  test("the scrim has a text zone", () => {
    expect(textZoneStops.length).toBeGreaterThan(0);
  });

  test("on-media is the same in Día and Noche", () => {
    expect(noche["on-media"]).toBe(dia["on-media"]);
  });

  test("on-media reaches 4.5:1 over the scrim text zone on a white image", () => {
    for (const { color, alpha } of textZoneStops) {
      expect(contrast(hexToRgb(dia["on-media"]), over(color, alpha, white))).toBeGreaterThanOrEqual(
        4.5,
      );
    }
  });

  test("the header's controls reach 4.5:1 over the top scrim's dense half on a white image", () => {
    const dense = [
      ...dia["scrim-top"].matchAll(/rgb\((\d+) (\d+) (\d+) \/ ([\d.]+)\) (\d+)%/g),
    ].filter(([, , , , , at]) => Number(at) <= 50);
    expect(dense.map(([, , , , , at]) => Number(at))).toEqual([0, 50]);
    for (const [, r, g, b, alpha] of dense) {
      const backdrop = over([Number(r), Number(g), Number(b)], Number(alpha), white);
      expect(contrast(hexToRgb(dia["on-media"]), backdrop)).toBeGreaterThanOrEqual(4.5);
    }
  });

  test("no warm brand colour is left (ADR 0014)", () => {
    expect(css).not.toMatch(/--(terracota|arena|sol)\b/);
  });
});
