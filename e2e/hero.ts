import { expect, type Locator } from "@playwright/test";

/** The landing's h1. */
export const motto = "Vivir frente al Mediterráneo, sin prisa.";

/** Waits until an image has loaded and decoded. */
export async function waitForImage(image: Locator) {
  await expect
    .poll(() =>
      image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0),
    )
    .toBe(true);
}
