import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// WCAG 2.1 A and AA, which includes text contrast of at least 4.5:1.
const wcagTags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

async function audit(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(wcagTags).analyze();
  // Report rule ids and offending selectors, so a failure says what to fix.
  return violations.map(({ id, nodes }) => `${id}: ${nodes.map((n) => n.target).join(" | ")}`);
}

/** Scroll down and back up a little, so the header shows as a solid panel over the content. */
async function showSolidHeader(page: Page) {
  await page.mouse.move(195, 400);
  await page.mouse.wheel(0, 1600);
  await page.mouse.wheel(0, -300);
  await expect(page.getByRole("banner")).toBeInViewport();
  await expect
    .poll(() =>
      page.getByRole("banner").evaluate((element) => getComputedStyle(element).backgroundColor),
    )
    .not.toBe("rgba(0, 0, 0, 0)");
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
