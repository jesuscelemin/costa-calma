import { expect, type Page } from "@playwright/test";

/** Waits until no RevealText is midway through its entry (hidden ones have not started yet). */
export async function waitForRevealsToSettle(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() =>
        [...document.querySelectorAll("[data-reveal-visual]")].every((element) => {
          const { opacity, visibility } = getComputedStyle(element);
          return opacity === "1" || visibility === "hidden";
        }),
      ),
    )
    .toBe(true);
}
