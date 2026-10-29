import { expect, type Page } from "@playwright/test";

import manifest from "../public/media/flight/manifest.json";

export { manifest as flightManifest };

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

/** Opacity of each chapter's text, in order. */
export function chapterOpacities(page: Page) {
  return page
    .locator("#vuelo article")
    .evaluateAll((articles) => articles.map((article) => getComputedStyle(article).opacity));
}

/** Waits until the clip has loaded far enough to be scrubbed (or, with 2, to show a frame). */
export async function waitForClip(page: Page, readyState: 1 | 2 = 1) {
  await expect
    .poll(() =>
      page.locator("#vuelo video").evaluate((video: HTMLVideoElement) => video.readyState),
    )
    .toBeGreaterThanOrEqual(readyState);
}
