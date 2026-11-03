import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

import { modelPalettes } from "./model-palette";

const css = readFileSync(new URL("../../../../../styles/tokens.css", import.meta.url), "utf8");

function token(selector: string, name: string) {
  const start = css.indexOf(`${selector} {`);
  const body = css.slice(start, css.indexOf("\n}", start));
  return new RegExp(`--${name}:\\s*([^;]+);`).exec(body)?.[1]?.trim().toLowerCase();
}

describe("the house model's palette", () => {
  const themes = [
    ["Día", modelPalettes.light, ":root"],
    ["Noche", modelPalettes.dark, ':root[data-theme="dark"]'],
  ] as const;

  for (const [name, palette, selector] of themes) {
    test(`in ${name}, is the corte's paper and ink, as the SVG drawing has them`, () => {
      expect(palette.background).toBe(token(selector, "surface"));
      expect(palette.paper).toBe(token(selector, "surface-raised"));
      expect(palette.ink).toBe(token(selector, "ink"));
      expect(palette.water).toBe(token(selector, "mar-soft"));
    });
  }
});
