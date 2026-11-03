import AxeBuilder from "@axe-core/playwright";

import { expect, test, type Page } from "./fixtures";

import { phaseBounds } from "../src/app/(site)/casas/[slug]/_lib/model-choreography";

// `npm run screenshots` saves the drawing, the lens open and the sweep halfway and at its end
// under docs/screenshots.
const capture = process.env.CAPTURE_SCREENSHOTS === "1";

const url = "/casas/villa-mar";

const model = (page: Page) => page.locator("section[data-model-phase]");
/** The poster's corte, on this screen: the accessible one. */
const poster = (page: Page) => model(page).locator("[data-model-poster] svg:visible");
/** The same corte, set in the scene on its plane. */
const sheet = (page: Page) => model(page).locator("[data-model-sheet] svg");
/** The scene's camera, as the sheet takes it in CSS 3D. */
const sheetView = (page: Page) => model(page).locator("[data-model-sheet] > div");
/** The drawing's place on its plane. */
const sheetPlace = (page: Page) => sheetView(page).locator("> div");

const sweep = phaseBounds("sweep");

/** Well inside each phase: the drawing, the lens held open, and the sweep halfway and done. */
const stops = [
  { id: "drawing", name: "drawing", progress: phaseBounds("drawing").end / 2 },
  { id: "lens", name: "lens", progress: phaseBounds("lens").end - 0.02 },
  { id: "sweep", name: "sweep-half", progress: sweep.start + (sweep.end - sweep.start) * 0.4 },
  { id: "sweep", name: "sweep", progress: 0.97 },
] as const;

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
  // The ease lands within about a second and a half; the scene then stops rendering.
  await page.waitForTimeout(2000);
}

/** Where an SVG draws its viewBox inside its box, centred and fitted as `meet` does. */
async function drawnBox(svg: ReturnType<typeof poster>) {
  return svg.evaluate((element: SVGSVGElement) => {
    const box = element.getBoundingClientRect();
    const { width, height } = element.viewBox.baseVal;
    const scale = Math.min(box.width / width, box.height / height);
    return {
      x: box.x + (box.width - width * scale) / 2,
      y: box.y + (box.height - height * scale) / 2,
      width: width * scale,
      height: height * scale,
    };
  });
}

test("shows the corte as its poster until the 3D draws the same corte in its place", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.goto(url);
  await expect(poster(page)).toHaveCount(1);
  await expect(poster(page)).toHaveAccessibleName("Corte de Villa Mar");
  await scrollModelTo(page, 0);
  await expect(model(page).locator("canvas")).toBeVisible();
  await settle(page);
  // Once the scene draws, the poster fades, and the corte on its plane is where the poster was.
  await expect(model(page).locator("[data-model-poster]")).toHaveCSS("opacity", "0");
  await expect(sheetPlace(page)).toHaveCSS("opacity", "1");
  const [drawn, placed] = await Promise.all([drawnBox(poster(page)), sheet(page).boundingBox()]);
  for (const key of ["x", "y", "width", "height"] as const) {
    expect(Math.abs(placed![key] - drawn[key]), key).toBeLessThan(1.5);
  }
  // The same lines, levels and cotas: the same drawing, hidden from readers, who read the poster.
  await expect(sheet(page)).toHaveAttribute("aria-hidden", "true");
  for (const text of ["+0,00", "+3,20", "+6,40", "4,4 m", "13 m", "Salón", "Piscina"]) {
    await expect(sheet(page).getByText(text, { exact: true })).toHaveCount(1);
  }
  expect(await sheet(page).locator("rect").count()).toBe(
    await poster(page).locator("rect").count(),
  );
  expect(errors).toEqual([]);
});

test("opens the lens and sweeps the corte with the scroll, and undoes both going back", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.goto(url);
  for (const { id, progress } of [...stops, ...stops.toReversed()]) {
    await scrollModelTo(page, progress);
    await expect(model(page)).toHaveAttribute("data-model-phase", id);
  }
  // Swept, the corte on its plane is gone; halfway, wiped from its left; before, whole.
  const wipe = () => sheetPlace(page).evaluate((place) => getComputedStyle(place).maskImage);
  await scrollModelTo(page, stops[3].progress);
  await settle(page);
  await expect(sheetPlace(page)).toHaveCSS("visibility", "hidden");
  await scrollModelTo(page, stops[2].progress);
  await settle(page);
  await expect(sheetPlace(page)).toHaveCSS("visibility", "visible");
  expect(await wipe()).toContain("linear-gradient");
  await scrollModelTo(page, stops[1].progress);
  await settle(page);
  expect(await wipe()).toBe("none");
  // Open, the corte on its plane turns with the camera; shut, it is square on again.
  const open = await sheetView(page).evaluate((view) => getComputedStyle(view).transform);
  await scrollModelTo(page, stops[0].progress);
  await settle(page);
  const shut = await sheetView(page).evaluate((view) => getComputedStyle(view).transform);
  expect(open).not.toBe(shut);
  expect(errors).toEqual([]);
});

test("in colour, the light follows the theme as it changes, without reloading", async ({
  page,
  isMobile,
}) => {
  // On a phone the theme toggle is in the menu; the scene's light is the same on both.
  test.skip(isMobile, "desktop's toggle");
  const errors = collectErrors(page);
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto(url);
  await scrollModelTo(page, stops[3].progress);
  await settle(page);
  const canvas = model(page).locator("canvas");
  // Marks on the page and on the canvas, which a reload or a new scene would lose.
  await canvas.evaluate((element) => {
    element.dataset.kept = "1";
    (window as unknown as { kept: boolean }).kept = true;
  });
  // Under the title: only the scene, where the house stands.
  const clip = (await model(page).locator("[data-model-area]").boundingBox())!;
  const noon = await page.screenshot({ clip });
  // The header has slid away over the scene: its toggle is pressed where it is, without scrolling.
  await page
    .getByRole("button", { name: "Cambiar a modo Noche" })
    .evaluate((button: HTMLButtonElement) => button.click());
  await settle(page);
  const dusk = await page.screenshot({ clip });
  expect(dusk.equals(noon)).toBe(false);
  await expect(canvas).toHaveAttribute("data-kept", "1");
  expect(await page.evaluate(() => (window as unknown as { kept?: boolean }).kept)).toBe(true);
  expect(errors).toEqual([]);
});

test("the corte's title stands at the top left of the scene", async ({ page }) => {
  await page.goto(url);
  await scrollModelTo(page, 0);
  const title = model(page).getByRole("heading", { level: 2, name: "Cortada de norte a sur" });
  await expect(title).toBeInViewport();
  const [box, drawing] = await Promise.all([title.boundingBox(), drawnBox(poster(page))]);
  expect(box!.x).toBeLessThan(page.viewportSize()!.width / 4);
  // Over the drawing, never on it.
  expect(box!.y + box!.height).toBeLessThanOrEqual(drawing.y + 1);
});

test("the skip link jumps past the model to the close of the page", async ({ page }) => {
  await page.goto(url);
  await model(page).getByRole("link", { name: "Saltar la maqueta" }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#otras-casas$/);
  await expect(page.getByRole("region", { name: "Otras casas" })).toBeInViewport();
});

test("the model takes the place of the floors' stretches and the 2D plans", async ({ page }) => {
  await page.goto(url);
  await expect(page.getByRole("region", { name: "Recorre la casa" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Planta a planta" })).toHaveCount(0);
  await expect(model(page).getByRole("button")).toHaveCount(0);
});

for (const colorScheme of ["light", "dark"] as const) {
  const theme = colorScheme === "light" ? "dia" : "noche";

  test(`the drawing, the lens open and the sweep in ${theme}: WCAG AA, no console errors, broken images or overflow`, async ({
    page,
  }, testInfo) => {
    const errors = collectErrors(page);
    await page.emulateMedia({ colorScheme });
    await page.goto(url);
    for (const { id, name, progress } of stops) {
      await scrollModelTo(page, progress);
      await expect(model(page)).toHaveAttribute("data-model-phase", id);
      await settle(page);
      const { violations } = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .include("section[data-model-phase]")
        .analyze();
      expect(
        violations.map(({ id, nodes }) => `${id}: ${nodes.map((n) => n.target).join(" | ")}`),
      ).toEqual([]);
      const faults = await page.evaluate(() => ({
        broken: [...document.images]
          .filter((image) => image.complete && image.naturalWidth === 0)
          .map((image) => image.currentSrc || image.src),
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      }));
      expect(faults).toEqual({ broken: [], overflow: 0 });
      if (capture) {
        await page.screenshot({
          path: `docs/screenshots/phase-3/house-model-${name}-${testInfo.project.name}-${theme}.png`,
        });
      }
    }
    expect(errors).toEqual([]);
  });
}

test.describe("with reduced motion", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  test("fades from the drawing to the depth, to colour, and back, instead of moving", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await page.goto(url);
    await scrollModelTo(page, stops[0].progress);
    await settle(page);
    const veil = model(page).locator("[data-model-veil]");
    for (const { id, progress } of [stops[1], stops[3], stops[1], stops[0]]) {
      await scrollModelTo(page, progress);
      // The scene goes out, takes the next phase, and comes back in.
      await expect(veil).toHaveAttribute("data-model-veil", "out");
      await expect(model(page)).toHaveAttribute("data-model-phase", id);
      await expect(veil).toHaveAttribute("data-model-veil", "in");
    }
    expect(errors).toEqual([]);
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

  test("shows the floors' 2D plans under the corte, the ground floor first", async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto(url);
    await model(page).scrollIntoViewIfNeeded();
    const floors = model(page).getByRole("group", { name: "Plantas" }).getByRole("button");
    await expect(model(page).getByRole("img", { name: "Plano de planta baja" })).toBeVisible();
    await expect(model(page).locator("canvas")).toHaveCount(0);
    // Not pinned: the page goes on under it.
    await expect(model(page).locator("[data-model-track]")).toHaveCount(0);
    await expect(floors.filter({ hasText: /^Planta baja$/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await floors.filter({ hasText: /^Primera planta$/ }).click();
    await expect(model(page).getByRole("img", { name: "Plano de primera planta" })).toBeVisible();
    expect(errors).toEqual([]);
  });

  for (const colorScheme of ["light", "dark"] as const) {
    const theme = colorScheme === "light" ? "dia" : "noche";

    test(`shows the house's corte first, described in words, in ${theme}`, async ({
      page,
    }, testInfo) => {
      const errors = collectErrors(page);
      await page.emulateMedia({ colorScheme });
      await page.goto(url);
      // The fallback's, once the page knows there is no WebGL: not the poster it replaces.
      const drawing = model(page)
        .locator("[data-model-section]")
        .getByRole("img", { name: "Corte de Villa Mar" });
      await drawing.scrollIntoViewIfNeeded();
      await expect(drawing).toBeVisible();
      await expect(drawing).toHaveAccessibleDescription(
        /Planta baja, a \+0,00: dormitorio de invitados y salón; el salón sube a doble altura, 6,4\sm\. Primera planta, a \+3,20: .*vuela 3\sm sobre el porche\./,
      );
      // Its levels and cotas, drawn as text: the chain and the whole, 13 m from the north to the sea.
      for (const text of ["+0,00", "+3,20", "+6,40", "4,4 m", "13 m"]) {
        await expect(drawing.getByText(text, { exact: true })).toBeVisible();
      }
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBe(0);
      const { violations } = await new AxeBuilder({ page })
        .include("section[data-model-phase]")
        .analyze();
      expect(violations).toEqual([]);
      if (capture) {
        await page.locator("[data-model-section]").screenshot({
          path: `docs/screenshots/phase-3/house-section-${testInfo.project.name}-${theme}.png`,
        });
      }
      expect(errors).toEqual([]);
    });
  }
});
