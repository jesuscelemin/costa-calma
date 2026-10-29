import { expect, type Page } from "@playwright/test";

const transparent = "rgba(0, 0, 0, 0)";

/** Whether the site header is see-through (over the hero and the flight). */
export function headerIsTransparent(page: Page) {
  return page
    .getByRole("banner")
    .evaluate(
      (element, transparent) => getComputedStyle(element).backgroundColor === transparent,
      transparent,
    );
}

/** Wheels from the middle of the screen, where the page scrolls. */
export async function wheel(page: Page, deltaY: number) {
  const { width, height } = page.viewportSize() ?? { width: 0, height: 0 };
  await page.mouse.move(width / 2, height / 2);
  await page.mouse.wheel(0, deltaY);
}

/** Scroll into the house types and back up a little, so the header shows as a solid panel. */
export async function showSolidHeader(page: Page) {
  // Lenis first finishes any wheel still under way, or it would carry the page back after the jump.
  await expect(page.locator("html")).not.toHaveClass(/\blenis-scrolling\b/);
  await page.locator("#tipologias").evaluate((element) => element.scrollIntoView());
  await wheel(page, 600);
  await wheel(page, -200);
  await expect(page.getByRole("banner")).toBeInViewport();
  await expect.poll(() => headerIsTransparent(page)).toBe(false);
}
