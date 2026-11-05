import AxeBuilder from "@axe-core/playwright";

import { expect, type Page } from "./fixtures";

// What every house model's spec drives it with: its section, its scroll, its console and axe.

/** The house model's pinned section. */
export const model = (page: Page) => page.locator("section[data-model-phase]");

/** Scrolls the model's pinned stretch to a share of its scroll (0–1). */
export async function scrollModelTo(page: Page, progress: number) {
  await model(page).evaluate((section, share) => {
    const track = section.querySelector<HTMLElement>("[data-model-track]")!;
    const top = track.getBoundingClientRect().top + window.scrollY;
    window.scrollTo(0, top + (track.offsetHeight - window.innerHeight) * share);
  }, progress);
}

/** Collects console errors and uncaught exceptions from now on. */
export function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

/** The model has drawn and its ease has had time to land. */
export async function settle(page: Page) {
  await expect(model(page)).toHaveAttribute("data-model-ready");
  // The ease lands within about a second; the scene then stops rendering.
  await page.waitForTimeout(1500);
}

/** The model as it stands: WCAG AA, and nothing wider than the screen. */
export async function expectAccessible(page: Page, name?: string) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .include("section[data-model-phase]")
    .analyze();
  expect(
    violations.map(({ id, nodes }) => `${id}: ${nodes.map((n) => n.target).join(" | ")}`),
    name,
  ).toEqual([]);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, name).toBe(0);
}
