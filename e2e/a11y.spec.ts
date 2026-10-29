import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "./fixtures";

import { flightManifest, showChapter, waitForClip } from "./flight";
import { showSolidHeader } from "./header";
import { waitForRevealsToSettle } from "./reveal";

// WCAG 2.1 A and AA, which includes text contrast of at least 4.5:1.
const wcagTags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

async function audit(page: Page) {
  // Text still fading in (RevealText) would be measured half transparent.
  await waitForRevealsToSettle(page);
  const { violations } = await new AxeBuilder({ page }).withTags(wcagTags).analyze();
  // Report rule ids and offending selectors, so a failure says what to fix.
  return violations.map(({ id, nodes }) => `${id}: ${nodes.map((n) => n.target).join(" | ")}`);
}

for (const colorScheme of ["light", "dark"] as const) {
  const theme = colorScheme === "light" ? "Día" : "Noche";

  test.describe(`${theme}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    });

    test("landing with the header over the hero passes WCAG AA", async ({ page }) => {
      await page.goto("/");
      expect(await audit(page)).toEqual([]);
    });

    test("landing with the solid header passes WCAG AA", async ({ page }) => {
      await page.goto("/");
      await showSolidHeader(page);
      expect(await audit(page)).toEqual([]);
    });

    for (const [index, { id }] of flightManifest.chapters.entries()) {
      test(`flight chapter "${id}" passes WCAG AA, with its still and with the clip`, async ({
        page,
      }) => {
        await page.goto("/");
        // Reduced motion (set above) shows the stills.
        await showChapter(page, index);
        expect(await audit(page)).toEqual([]);

        await page.emulateMedia({ reducedMotion: "no-preference" });
        await waitForClip(page, 2);
        await showChapter(page, index);
        expect(await audit(page)).toEqual([]);
      });
    }

    test("open mobile menu passes WCAG AA", async ({ page, isMobile }) => {
      test.skip(!isMobile, "The menu only exists on small screens");
      await page.goto("/");
      await page.getByRole("banner").getByRole("button", { name: "Abrir menú" }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      expect(await audit(page)).toEqual([]);
    });

    test("404 page passes WCAG AA", async ({ page }) => {
      await page.goto("/esta-pagina-no-existe");
      expect(await audit(page)).toEqual([]);
    });
  });
}
