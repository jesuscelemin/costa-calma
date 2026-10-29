import { INTRO_FADE_MS, INTRO_MAX_MS, INTRO_MIN_MS } from "../src/lib/intro";

import { expect, test, type Page } from "./fixtures";
import { clipPattern } from "./flight";
import { motto } from "./hero";

// These tests are about the intro itself: start each one at the beginning of a session.
test.use({ intro: "unseen" });

// `npm run screenshots` sets this to save the animation's frames under docs/screenshots.
const capture = process.env.CAPTURE_SCREENSHOTS === "1";

/** One animation frame, in ms; the samples below can be off by about that much. */
const FRAME = 50;

type Marks = {
  /** When the overlay was first painted. */
  shown?: number;
  /** When it started to fade. */
  lifted?: number;
  /** When it was gone. */
  gone?: number;
  /** When the motto was first split into moving words. */
  split?: number;
  /** Whether the overlay faded through partial opacity, not with a cut. */
  faded: boolean;
};

/** Records, frame by frame from the very start, what the intro does and when. */
async function recordIntro(page: Page) {
  await page.addInitScript(() => {
    const marks: Marks = { faded: false };
    Object.assign(window, { introMarks: marks });
    const sample = (now: number) => {
      const overlay = document.querySelector("[data-intro-overlay]");
      if (overlay) {
        const { display, opacity, visibility } = getComputedStyle(overlay);
        const visible = display !== "none" && visibility !== "hidden" && Number(opacity) > 0;
        if (visible && marks.shown === undefined) marks.shown = now;
        if (marks.shown !== undefined) {
          if (Number(opacity) < 1 && marks.lifted === undefined) marks.lifted = now;
          if (visible && Number(opacity) < 1) marks.faded = true;
          if (!visible && marks.gone === undefined) marks.gone = now;
        }
      }
      if (marks.split === undefined && document.querySelector("h1 .word")) marks.split = now;
      if (marks.gone === undefined) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
}

/** What `recordIntro` has seen so far. */
function readMarks(page: Page) {
  return page.evaluate(() => (window as unknown as { introMarks: Marks }).introMarks);
}

/** What `recordIntro` saw, once the intro is gone. */
async function introMarks(page: Page) {
  await expect.poll(async () => (await readMarks(page)).gone).toBeDefined();
  return readMarks(page);
}

const overlay = (page: Page) => page.locator("[data-intro-overlay]");

test("plays on the first visit to the landing, for as long as the preload within its bounds", async ({
  page,
}) => {
  await recordIntro(page);
  await page.goto("/");

  // Announced while it covers the page, without hiding the page from screen readers.
  await expect(page.getByRole("status").filter({ hasText: "Cargando" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveAccessibleName(motto);

  const { shown, lifted, gone, faded } = await introMarks(page);
  if (shown === undefined || lifted === undefined || gone === undefined) {
    throw new Error("The intro did not play through");
  }
  expect(lifted - shown).toBeGreaterThanOrEqual(INTRO_MIN_MS - FRAME);
  expect(lifted - shown).toBeLessThanOrEqual(INTRO_MAX_MS + FRAME);
  // Then a fade, of about the brand's slow movement.
  expect(faded).toBe(true);
  expect(gone - lifted).toBeGreaterThanOrEqual(INTRO_FADE_MS - 2 * FRAME);
  expect(gone - lifted).toBeLessThanOrEqual(INTRO_FADE_MS + 2 * FRAME);
  await expect(overlay(page)).toBeHidden();
  await expect(page.locator("html")).not.toHaveAttribute("data-intro");
});

test("waits for the flight's clip, but never past the maximum", async ({ page }) => {
  await page.route(clipPattern, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 2 * INTRO_MAX_MS));
    await route.continue();
  });
  await recordIntro(page);
  await page.goto("/");

  const { shown, lifted } = await introMarks(page);
  if (shown === undefined || lifted === undefined) throw new Error("The intro did not lift");
  expect(lifted - shown).toBeGreaterThanOrEqual(INTRO_MAX_MS - 2 * FRAME);
  expect(lifted - shown).toBeLessThanOrEqual(INTRO_MAX_MS + FRAME);
});

test("the motto starts to rise only as the intro lifts", async ({ page }) => {
  await recordIntro(page);
  await page.goto("/");

  const { lifted, split } = await introMarks(page);
  await expect.poll(() => page.locator("h1 .word").count()).toBeGreaterThan(1);
  if (lifted === undefined) throw new Error("The intro did not lift");
  const splitAt = split ?? Infinity;
  expect(splitAt).toBeGreaterThanOrEqual(lifted - FRAME);
});

test("the page under it stays still until it lifts", async ({ page }) => {
  await page.goto("/");
  await expect(overlay(page)).toBeVisible();
  await page.mouse.wheel(0, 800);
  expect(await page.evaluate(() => scrollY)).toBe(0);

  await expect(overlay(page)).toBeHidden();
  await page.mouse.wheel(0, 800);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
});

test("does not play again on a reload in the same session", async ({ page }) => {
  await page.goto("/");
  await expect(overlay(page)).toBeVisible();
  await expect(overlay(page)).toBeHidden();

  await recordIntro(page);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect((await readMarks(page)).shown).toBeUndefined();
  await expect(page.locator("html")).not.toHaveAttribute("data-intro");
});

test("does not play when the session starts on a direct link to another page", async ({ page }) => {
  await recordIntro(page);
  await page.goto("/esta-pagina-no-existe");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(overlay(page)).toHaveCount(0);

  // Nor later on the landing, in the same session.
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect((await readMarks(page)).shown).toBeUndefined();
});

test("with reduced motion the logo stands still and the overlay only fades", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await recordIntro(page);
  await page.goto("/");

  await expect(overlay(page)).toBeVisible();
  const moving = await overlay(page)
    .locator("[data-part]")
    .evaluateAll((parts) => parts.flatMap((part) => part.getAnimations()).length);
  expect(moving).toBe(0);

  const { faded } = await introMarks(page);
  expect(faded).toBe(true);
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the page shows straight away, without the intro", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("banner")).toBeVisible();
    await expect(overlay(page)).toBeHidden();
    await expect(page.locator("html")).not.toHaveAttribute("data-intro");
  });
});

test.describe("captures", () => {
  test.skip(!capture, "Only with npm run screenshots");

  for (const colorScheme of ["light", "dark"] as const) {
    const theme = colorScheme === "light" ? "dia" : "noche";

    test(`the sun rising, in ${theme}`, async ({ page }, testInfo) => {
      await page.emulateMedia({ colorScheme });
      // Without the app's scripts the intro never lifts, so any frame can be held still.
      await page.route("**/_next/static/chunks/**/*.js", (route) => route.abort());
      await page.goto("/", { waitUntil: "load" });
      await expect(overlay(page)).toBeVisible();

      for (const [frame, at] of [
        ["rising", 400],
        ["risen", 1600],
      ] as const) {
        await page.evaluate((at) => {
          for (const animation of document.getAnimations()) {
            // Scroll-driven animations (the footer's) run on progress, not time.
            if (!(animation.timeline instanceof DocumentTimeline)) continue;
            animation.pause();
            animation.currentTime = at;
          }
        }, at);
        await page.screenshot({
          path: `docs/screenshots/phase-2/intro-${frame}-${testInfo.project.name}-${theme}.png`,
          style: "nextjs-portal { display: none !important; }",
        });
      }
    });
  }
});
