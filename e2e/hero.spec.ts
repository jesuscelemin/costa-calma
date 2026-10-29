import { expect, test } from "@playwright/test";

import { flightManifest } from "./flight";
import { motto, waitForImage } from "./hero";

test("the h1 is the motto, and the giant brand name is only decoration", async ({ page }) => {
  await page.goto("/");
  const hero = page.locator("#hero");

  await expect(page.getByRole("heading", { level: 1 })).toHaveAccessibleName(motto);
  await expect(hero.getByRole("heading", { level: 1 }).getByRole("emphasis")).toHaveText(
    "sin prisa",
  );
  await expect(hero.getByText("Obra nueva junto al Mediterráneo")).toBeVisible();
  // Seen, but not read: screen readers hear the motto only.
  await expect(hero.getByText("Costa Calma", { exact: true })).toBeVisible();
  expect(await hero.ariaSnapshot()).not.toContain("Costa Calma");
});

test("the hero image is the flight's poster for the screen, and it is the LCP", async ({
  page,
  isMobile,
}) => {
  await page.goto("/");
  const poster = flightManifest.sources[isMobile ? "mobile" : "desktop"].poster;

  const image = page.locator("#hero img");
  await waitForImage(image);
  const source = await image.evaluate((element: HTMLImageElement) => element.currentSrc);
  expect(decodeURIComponent(source)).toContain(poster);
  expect(await image.getAttribute("fetchpriority")).toBe("high");

  const largest = await page.evaluate(
    () =>
      new Promise<string | undefined>((resolve) => {
        new PerformanceObserver((list) => {
          const entries = list.getEntries() as (PerformanceEntry & { element?: Element })[];
          resolve(entries.at(-1)?.element?.tagName);
        }).observe({ type: "largest-contentful-paint", buffered: true });
      }),
  );
  expect(largest).toBe("IMG");
});

test("the motto rises word by word", async ({ page }) => {
  await page.goto("/");
  const title = page.getByRole("heading", { level: 1 });

  await expect.poll(() => title.locator(".word").count()).toBeGreaterThan(1);
  await expect
    .poll(() =>
      title.evaluate((element) =>
        [...element.querySelectorAll<HTMLElement>(".word")].every(
          (word) => new DOMMatrixReadOnly(getComputedStyle(word).transform).m42 === 0,
        ),
      ),
    )
    .toBe(true);
});

test("with reduced motion the motto only fades in", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  // Every frame from the start, how opaque the motto is and whether it has moved.
  await page.addInitScript(() => {
    const samples: { opacity: number; moved: boolean }[] = [];
    Object.assign(window, { mottoSamples: samples });
    const sample = () => {
      const visual = document.querySelector<HTMLElement>("h1 [data-reveal-visual]");
      // Only what can be seen: until RevealText takes over, the moving copy is hidden.
      if (visual && getComputedStyle(visual).visibility === "visible") {
        const words = [...visual.querySelectorAll<HTMLElement>(".word")];
        samples.push({
          opacity: Number(getComputedStyle(visual).opacity),
          moved: words.length > 0,
        });
      }
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  await page.goto("/");
  const samples = () =>
    page.evaluate(
      () =>
        (window as unknown as { mottoSamples: { opacity: number; moved: boolean }[] }).mottoSamples,
    );

  await expect.poll(async () => (await samples()).at(-1)?.opacity).toBe(1);
  const seen = await samples();
  // Somewhere between hidden and shown: a fade, not a cut. And never split into moving words.
  expect(seen.some(({ opacity }) => opacity > 0 && opacity < 1)).toBe(true);
  expect(seen.some(({ moved }) => moved)).toBe(false);
});

test("the hero's text fits the frame, without overflowing or being cut", async ({ page }) => {
  await page.goto("/");
  const frame = await page.locator("#hero > div").boundingBox();
  if (!frame) throw new Error("No hero frame");

  for (const text of [
    page.getByText("Costa Calma", { exact: true }),
    page.getByText("Obra nueva junto al Mediterráneo"),
    page.getByRole("heading", { level: 1 }),
  ]) {
    const box = await text.boundingBox();
    expect(box).not.toBeNull();
    if (!box) continue;
    expect(box.x).toBeGreaterThanOrEqual(frame.x);
    expect(box.y).toBeGreaterThanOrEqual(frame.y);
    expect(box.x + box.width).toBeLessThanOrEqual(frame.x + frame.width + 1);
    expect(box.y + box.height).toBeLessThanOrEqual(frame.y + frame.height + 1);
  }
  // The bottom band the scrim keeps legible holds the eyebrow and the motto whole.
  const band = page.locator("#hero").getByRole("heading", { level: 1 }).locator("..");
  expect(await band.evaluate((element) => element.scrollHeight <= element.clientHeight + 1)).toBe(
    true,
  );
});
