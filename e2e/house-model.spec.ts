import { mkdirSync } from "node:fs";

import sharp from "sharp";

import { expect, test, type Page } from "./fixtures";

import { modelPhases, phaseBounds } from "../src/app/(site)/casas/[slug]/_lib/model-choreography";
import { modelPoster } from "../src/features/houses/media";

// `npm run screenshots` saves each phase under docs/screenshots; `npm run media:model-posters`
// captures the posters the model shows while it loads.
const capture = process.env.CAPTURE_SCREENSHOTS === "1";
const capturePosters = process.env.CAPTURE_MODEL_POSTERS === "1";

const slug = "villa-mar";
const url = `/casas/${slug}`;

const model = (page: Page) => page.locator("section[data-model-phase]");

/** The share of each phase the scroll stops at: well inside it, past its eased start. */
const stops = modelPhases.map(({ id }) => {
  const { start, end } = phaseBounds(id);
  return { id, progress: start + (end - start) * 0.7 };
});

/** Scrolls the model's pinned stretch to a share of its scroll (0–1). */
async function scrollModelTo(page: Page, progress: number) {
  await model(page).evaluate((section, share) => {
    const track = section.querySelector<HTMLElement>("[data-model-track]")!;
    const top = track.getBoundingClientRect().top + window.scrollY;
    window.scrollTo(0, top + (track.offsetHeight - window.innerHeight) * share);
  }, progress);
}

/** Collects console errors and uncaught exceptions from now on. */
function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

/** The model has drawn and its ease has had time to land. */
async function settle(page: Page) {
  await expect(model(page)).toHaveAttribute("data-model-ready");
  // The ease lands within about a second; the scene then stops rendering.
  await page.waitForTimeout(1500);
}

test("shows its poster until the 3D draws, then the canvas", async ({ page }) => {
  await page.goto(url);
  // The theme's poster, the other one is not even downloaded.
  const poster = model(page).locator("[data-model-poster] img:visible");
  await expect(poster).toHaveCount(1);
  await scrollModelTo(page, 0);
  await expect
    .poll(() =>
      poster.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0),
    )
    .toBe(true);
  await expect(model(page).locator("canvas")).toBeVisible();
  await expect(model(page)).toHaveAttribute("data-model-ready");
  // Once the model draws, the poster fades away.
  await expect(model(page).locator("[data-model-poster]")).toHaveCSS("opacity", "0");
});

test("builds the house with the scroll, phase by phase, and takes it apart going back", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.goto(url);
  for (const { id, progress } of stops) {
    await scrollModelTo(page, progress);
    await expect(model(page)).toHaveAttribute("data-model-phase", id);
    await expect(model(page).locator("article[data-active] h3")).toHaveCount(1);
  }
  await expect(model(page).locator("article[data-active] h3")).toHaveText("Se abre en el aire");
  for (const { id, progress } of stops.toReversed()) {
    await scrollModelTo(page, progress);
    await expect(model(page)).toHaveAttribute("data-model-phase", id);
  }
  await expect(model(page).locator("article[data-active] h3")).toHaveText("Empieza en el terreno");
  await settle(page);
  expect(errors).toEqual([]);
});

test("«Ver los planos» leads to the 2D plans", async ({ page }) => {
  await page.goto(url);
  await scrollModelTo(page, 0.5);
  await model(page).getByRole("link", { name: "Ver los planos" }).click();
  await expect(page).toHaveURL(/#planos$/);
  await expect(page.getByRole("region", { name: "Planos de Villa Mar" })).toBeInViewport();
});

test.describe("with reduced motion", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  test("shows the house already open, without a pinned stretch to scroll through", async ({
    page,
  }) => {
    await page.goto(url);
    await model(page).scrollIntoViewIfNeeded();
    await expect(model(page)).toHaveAttribute("data-model-phase", "open");
    await expect(model(page).locator("article[data-active] h3")).toHaveText("Se abre en el aire");
    await expect(model(page).locator("canvas")).toBeVisible();
    const height = await model(page).evaluate((section) => section.getBoundingClientRect().height);
    expect(height).toBeLessThan(page.viewportSize()!.height * 1.5);
  });
});

test.describe("without WebGL", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      // A browser without WebGL: asking for it gives nothing, anything else works as usual.
      const getContext = HTMLCanvasElement.prototype.getContext;
      Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
        value(this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
          if (type.startsWith("webgl")) return null;
          return Reflect.apply(getContext, this, [type, ...rest]);
        },
      });
    });
  });

  test("shows the ground floor's 2D plan in the model's place", async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto(url);
    await model(page).scrollIntoViewIfNeeded();
    await expect(model(page).getByRole("img", { name: "Plano de planta baja" })).toBeVisible();
    await expect(model(page).locator("canvas")).toHaveCount(0);
    await expect(model(page)).toHaveAttribute("data-model-phase", "open");
    expect(errors).toEqual([]);
  });
});

for (const colorScheme of ["light", "dark"] as const) {
  const theme = colorScheme === "light" ? "dia" : "noche";

  test(`every phase in ${theme}: no console errors, broken images or overflow`, async ({
    page,
  }, testInfo) => {
    const errors = collectErrors(page);
    await page.emulateMedia({ colorScheme });
    await page.goto(url);
    for (const { id, progress } of stops) {
      await scrollModelTo(page, progress);
      await expect(model(page)).toHaveAttribute("data-model-phase", id);
      await settle(page);
      const faults = await page.evaluate(() => ({
        broken: [...document.images]
          .filter((image) => image.complete && image.naturalWidth === 0)
          .map((image) => image.currentSrc || image.src),
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      }));
      expect(faults).toEqual({ broken: [], overflow: 0 });
      if (capture) {
        await page.screenshot({
          path: `docs/screenshots/phase-3/house-model-${id}-${testInfo.project.name}-${theme}.png`,
        });
      }
    }
    expect(errors).toEqual([]);
  });
}

test.describe("posters", () => {
  test.skip(!capturePosters, "Only with npm run media:model-posters");

  for (const colorScheme of ["light", "dark"] as const) {
    test(`captures the empty plot in ${colorScheme}`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== "desktop", "One poster for every screen");
      // On desktop the canvas is about as tall as wide, like the box on phones, which crops it a
      // little at the sides.
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.emulateMedia({ colorScheme });
      await page.goto(url);
      await scrollModelTo(page, 0);
      await settle(page);
      const canvas = model(page).locator("canvas");
      // Hide the poster's fading copy, which may still sit over the canvas.
      await model(page)
        .locator("[data-model-poster]")
        .evaluate((poster) => poster.remove());
      const shot = await canvas.screenshot();
      const { day, night } = modelPoster(slug);
      const path = `public${colorScheme === "light" ? day : night}`;
      mkdirSync(path.slice(0, path.lastIndexOf("/")), { recursive: true });
      await sharp(shot).resize({ width: 1200 }).webp({ quality: 82 }).toFile(path);
    });
  }
});
