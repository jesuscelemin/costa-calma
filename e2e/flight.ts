import { expect, type Page } from "./fixtures";

import manifest from "../public/media/flight/manifest.json";

export { manifest as flightManifest };

/** Path of any flight clip, in either format. */
export const clipPattern = /\/media\/flight\/.+\.(mp4|webm)$/;

/**
 * Scrolls to the middle of a chapter's stretch of the flight, where it holds for reading. A
 * chapter's stretch is as long as its share of the clip.
 */
export async function scrollToChapter(page: Page, index: number) {
  const { start, end } = manifest.chapters[index];
  const progress = (start + end) / 2 / manifest.duration;
  await page.locator("#vuelo [data-scrub-track]").evaluate((track, progress) => {
    const { top, height } = track.getBoundingClientRect();
    window.scrollTo(0, top + window.scrollY + (height - window.innerHeight) * progress);
  }, progress);
}

/** Scrolls to a chapter and waits until its text is fully in. */
export async function showChapter(page: Page, index: number) {
  await scrollToChapter(page, index);
  await expect.poll(async () => (await chapterOpacities(page))[index]).toBe("1");
}

/** Opacity of each chapter's text, in order. */
export function chapterOpacities(page: Page) {
  return page
    .locator("#vuelo article")
    .evaluateAll((articles) => articles.map((article) => getComputedStyle(article).opacity));
}

/** Opacity of each chapter's still (the motionless flight), in order. */
export function stillOpacities(page: Page) {
  return page
    .locator("#vuelo picture")
    .evaluateAll((stills) => stills.map((still) => getComputedStyle(still).opacity));
}

/** Every request the page makes for a flight clip, as it makes it. */
export function clipRequests(page: Page) {
  const urls: string[] = [];
  page.on("request", (request) => {
    if (clipPattern.test(new URL(request.url()).pathname)) {
      urls.push(request.url());
    }
  });
  return urls;
}

/** Waits until the clip has loaded far enough to be scrubbed (or, with 2, to show a frame). */
export async function waitForClip(page: Page, readyState: 1 | 2 = 1) {
  await expect
    .poll(() =>
      page.locator("#vuelo video").evaluate((video: HTMLVideoElement) => video.readyState),
    )
    .toBeGreaterThanOrEqual(readyState);
}
