import { expect, test } from "@playwright/test";

import {
  chapterOpacities,
  flightManifest as manifest,
  scrollToChapter,
  waitForClip,
} from "./flight";

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

test("the flight keeps its anchor and leads into the house types", async ({ page }) => {
  await page.goto("/");

  const ids = await page
    .locator("main > section[id]")
    .evaluateAll((sections) => sections.map((section) => section.id));
  expect(ids.indexOf("tipologias")).toBe(ids.indexOf("vuelo") + 1);
  await expect(page.locator("#vuelo").getByRole("heading", { level: 2 })).toHaveText("El vuelo");
});
