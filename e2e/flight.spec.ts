import { expect, test, type Page } from "./fixtures";

import {
  chapterOpacities,
  clipPattern,
  clipRequests,
  flightManifest as manifest,
  scrollToChapter,
  stillOpacities,
  waitForClip,
} from "./flight";
import { headerIsTransparent, showSolidHeader, wheel } from "./header";

// Chapter titles from spec #10, in the order of the manifest's chapters.
const titles = ["Llegar sin prisa", "A cien pasos de la arena", "Tu casa, frente al mar"];

test("each chapter's title shows while the scroll is in its stretch of the flight", async ({
  page,
}) => {
  await page.goto("/");
  const flight = page.locator("#vuelo");

  for (const [index, title] of titles.entries()) {
    await scrollToChapter(page, index);

    await expect(flight.getByRole("heading", { level: 3, name: title })).toBeInViewport();
    // Only this chapter's text is on screen; the others have gone with the camera.
    await expect
      .poll(() => chapterOpacities(page))
      .toEqual(titles.map((_, i) => (i === index ? "1" : "0")));
  }
});

test("the camera moves forwards and back with the scroll, and holds in each chapter", async ({
  page,
}) => {
  await page.goto("/");
  const video = page.locator("#vuelo video");
  // The clip is loaded whole before it can be scrubbed.
  await waitForClip(page);

  // Down the flight and back up: in the middle of each chapter's stretch, its middle frame.
  for (const index of [0, 1, 2, 1, 0]) {
    await scrollToChapter(page, index);
    const { start, end } = manifest.chapters[index];
    await expect
      .poll(() => video.evaluate((element: HTMLVideoElement) => element.currentTime))
      .toBeCloseTo((start + end) / 2, 1);
  }
});

test("leaving the flight in a hurry leaves the camera at its start or its end", async ({
  page,
}) => {
  await page.goto("/");
  const video = page.locator("#vuelo video");
  const currentTime = () => video.evaluate((element: HTMLVideoElement) => element.currentTime);
  await waitForClip(page);

  // Straight from the last chapter back up to the hero: the first frame waits there.
  const last = manifest.chapters[2];
  await scrollToChapter(page, 2);
  await expect.poll(currentTime).toBeCloseTo((last.start + last.end) / 2, 1);
  await page.evaluate(() => window.scrollTo(0, 0));
  // The clips run at 24 fps: anything under 1/24 s is the first frame.
  await expect.poll(currentTime).toBeLessThan(1 / 24);

  // Jumping past the whole flight, then back into its last chapter: it lands there straight
  // away, instead of easing across the flight from the sea and through the beach.
  await page.locator("#tipologias").evaluate((element) => element.scrollIntoView());
  const activeChapters = await page.evaluateHandle(() => {
    const seen: number[] = [];
    const sample = () => {
      const articles = [...document.querySelectorAll("#vuelo article")];
      seen.push(articles.findIndex((article) => article.hasAttribute("data-active")));
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
    return seen;
  });
  await scrollToChapter(page, 2);
  await expect.poll(() => activeChapters.evaluate((seen) => seen.at(-1))).toBe(2);
  expect(await activeChapters.evaluate((seen) => seen.includes(1))).toBe(false);
});

test("a phone plays the vertical clip over a shorter flight", async ({ page, isMobile }) => {
  const requests = clipRequests(page);
  await page.goto("/");
  await waitForClip(page);

  const format = isMobile ? "mobile" : "desktop";
  expect(requests.length).toBeGreaterThan(0);
  expect(requests.every((url) => url.includes(`/media/flight/${format}/`))).toBe(true);
  // About 300 vh of flight on a phone, 400 vh on desktop.
  const screens = await page
    .locator("#vuelo [data-scrub-track]")
    .evaluate((track) => track.getBoundingClientRect().height / window.innerHeight);
  expect(screens).toBeCloseTo(isMobile ? 3 : 4, 1);
});

/** Walks the flight's chapters, checking each shows its still and its title, and only those. */
async function expectStillsThroughTheFlight(page: Page) {
  for (const [index, title] of titles.entries()) {
    await scrollToChapter(page, index);
    await expect(
      page.locator("#vuelo").getByRole("heading", { level: 3, name: title }),
    ).toBeInViewport();
    // Each still lies over the ones before it, so the chapters passed stay underneath.
    await expect
      .poll(() => stillOpacities(page))
      .toEqual(titles.map((_, i) => (i <= index ? "1" : "0")));
    await expect
      .poll(() => chapterOpacities(page))
      .toEqual(titles.map((_, i) => (i === index ? "1" : "0")));
  }
}

test.describe("without the clip", () => {
  test("with reduced motion, each chapter shows its still and the clip is never asked for", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const requests = clipRequests(page);
    await page.goto("/");

    await expectStillsThroughTheFlight(page);
    await expect(page.locator("#vuelo video")).toHaveCount(0);
    // The text stays put as it fades: no drifting with the scroll.
    const drift = await page
      .locator("#vuelo article[data-active]")
      .evaluate((article) => getComputedStyle(article).translate);
    expect(drift).toBe("none");
    expect(requests).toEqual([]);
  });

  test("when the clip fails to load, the stills take its place", async ({ page }) => {
    await page.route(clipPattern, (route) => route.abort());
    await page.goto("/");

    await expect(page.locator("#vuelo video")).toHaveCount(0);
    await expectStillsThroughTheFlight(page);
  });

  test("with Save-Data on, the clip is never asked for", async ({ page }) => {
    await page.addInitScript(() => {
      const connection = Object.assign(new EventTarget(), { saveData: true });
      Object.defineProperty(Navigator.prototype, "connection", { get: () => connection });
    });
    const requests = clipRequests(page);
    await page.goto("/");

    await expectStillsThroughTheFlight(page);
    expect(requests).toEqual([]);
  });
});

test('"Saltar el vuelo" shows when focused and goes straight to the house types', async ({
  page,
}) => {
  await page.goto("/");
  const skip = page.getByRole("link", { name: "Saltar el vuelo" });
  await expect(skip).not.toBeInViewport();

  await skip.focus();
  await expect(skip).toBeInViewport();
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(/#tipologias$/);
  await expect(
    page.locator("#tipologias").getByRole("heading", { name: "Tipologías" }),
  ).toBeInViewport();
});

test("the header is transparent over the hero and the whole flight, and solid from the house types on", async ({
  page,
}) => {
  await page.goto("/");
  await expect.poll(() => headerIsTransparent(page)).toBe(true);

  // Deep in the flight, scrolling back up a little brings the header back, still transparent.
  await scrollToChapter(page, 2);
  await wheel(page, -200);
  await expect(page.getByRole("banner")).toBeInViewport();
  await expect.poll(() => headerIsTransparent(page)).toBe(true);

  await showSolidHeader(page);
});

test("the flight keeps its anchor and leads into the house types", async ({ page }) => {
  await page.goto("/");

  const ids = await page
    .locator("main > section[id]")
    .evaluateAll((sections) => sections.map((section) => section.id));
  expect(ids.indexOf("tipologias")).toBe(ids.indexOf("vuelo") + 1);
  await expect(page.locator("#vuelo").getByRole("heading", { level: 2 })).toHaveText("El vuelo");
});
