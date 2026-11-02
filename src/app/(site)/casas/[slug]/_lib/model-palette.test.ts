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
    test(`in ${name}, stands on the page's surface and draws its plan in ink`, () => {
      expect(palette.background).toBe(token(selector, "surface"));
      expect(palette.ink).toBe(token(selector, "ink"));
      // Sol is the same in both themes, so Noche does not override it.
      expect(palette.light).toBe(token(":root", "sol"));
    });
  }

  test("by night, the ground's light is the darkest surface, never black", () => {
    expect(modelPalettes.dark.groundLight).toBe(
      token(':root[data-theme="dark"]', "surface-sunken"),
    );
  });
});
