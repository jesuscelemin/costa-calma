import { expect, type Page } from "./fixtures";

/**
 * Waits until no RevealText is midway through its entry (hidden ones have not started yet). Two
 * settled reads in a row, each after a frame: a scroll just made may still start an entry.
 */
export async function waitForRevealsToSettle(page: Page) {
  let settledBefore = false;
  await expect
    .poll(async () => {
      const settled = await page.evaluate(async () => {
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        return [...document.querySelectorAll("[data-reveal-visual]")].every((element) => {
          const { opacity, visibility } = getComputedStyle(element);
          return opacity === "1" || visibility === "hidden";
        });
      });
      const stable = settled && settledBefore;
      settledBefore = settled;
      return stable;
    })
    .toBe(true);
}
