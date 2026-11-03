import AxeBuilder from "@axe-core/playwright";

import { expect, test, type Page } from "./fixtures";

import { phaseBounds, stopProgress } from "../src/app/(site)/casas/[slug]/_lib/model-choreography";
import { tourStops } from "../src/app/(site)/casas/[slug]/_lib/tour";
import { villaMarPlan } from "../src/features/houses/plans/villa-mar";

// `npm run screenshots` saves the sheet, the walls up, the descent, the landing in front of the
// door, and each stop of the tour under docs/screenshots.
const capture = process.env.CAPTURE_SCREENSHOTS === "1";

const url = "/casas/villa-mar";

const model = (page: Page) => page.locator("section[data-model-phase]");
/** The sheet as readers have it: the ground floor's plan, in words. */
const sheet = (page: Page) =>
  model(page).getByRole("img", { name: "Plano de la planta baja de Villa Mar" });
/** The camera's lens, height and cut. */
const hud = (page: Page) => model(page).locator("[data-model-hud]");

const bounds = (id: "sheet" | "lift" | "descent" | "tour" | "finale") =>
  phaseBounds(id, villaMarPlan);
const middle = (id: "sheet" | "lift" | "descent") => (bounds(id).start + bounds(id).end) / 2;

/** Well inside each phase: the sheet, the walls risen, the descent, the landing and the end. */
const phaseStops = [
  { id: "sheet", name: "sheet", progress: middle("sheet") },
  { id: "lift", name: "lift", progress: bounds("lift").end - 0.005 },
  { id: "descent", name: "descent", progress: middle("descent") },
  { id: "tour", name: "landed", progress: bounds("tour").start + 0.002 },
  { id: "finale", name: "finale", progress: 1 },
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
  // The ease lands within about a second; the scene then stops rendering.
  await page.waitForTimeout(1500);
}

test("starts on the sheet: the ground floor from above, its rooms in words, cut at +1,20 m", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.goto(url);
  await scrollModelTo(page, 0);
  await expect(model(page).locator("canvas")).toBeVisible();
  await settle(page);
  await expect(model(page)).toHaveAttribute("data-model-phase", "sheet");
  await expect(sheet(page)).toHaveAccessibleDescription(
    /^Plano de la planta baja de Villa Mar, visto desde arriba, con la puerta al norte: .*recibidor, 15\sm².*salón, 42\sm²/,
  );
  await expect(hud(page)).toHaveText(/^Lente 2° · Altura [\d.]+\sm · Corte \+1,20\sm$/);
  // Shown on desktop only: on a phone the title and the locator have the top of the screen.
  expect(errors).toEqual([]);
});

test("rises from the sheet and comes down to the door with the scroll, and back", async ({
  page,
  isMobile,
}) => {
  const errors = collectErrors(page);
  await page.goto(url);
  for (const { id, progress } of [...phaseStops, ...phaseStops.toReversed()]) {
    await scrollModelTo(page, progress);
    await expect(model(page)).toHaveAttribute("data-model-phase", id);
  }
  // Landed: eye height, the tour's lens (taller on a phone held upright), and the house whole.
  await scrollModelTo(page, phaseStops[3].progress);
  await settle(page);
  await expect(hud(page)).toHaveText(
    `Lente ${isMobile ? 70 : 50}° · Altura 1,6\u00a0m · Sin corte`,
  );
  await scrollModelTo(page, phaseStops[1].progress);
  await settle(page);
  await expect(hud(page)).toContainText("Corte +2,");
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
  // In the hall, the first room in colour.
  await scrollModelTo(page, stopProgress(0, villaMarPlan));
  await settle(page);
  const canvas = model(page).locator("canvas");
  // Marks on the page and on the canvas, which a reload or a new scene would lose.
  await canvas.evaluate((element) => {
    element.dataset.kept = "1";
    (window as unknown as { kept: boolean }).kept = true;
  });
  const clip = { x: 0, y: 0, ...page.viewportSize()! };
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

test("the sheet's title stands at the top left, clear of the plan", async ({ page }) => {
  await page.goto(url);
  await scrollModelTo(page, 0);
  const title = model(page).getByRole("heading", { level: 2, name: "De la puerta al mar" });
  await expect(title).toBeInViewport();
  const [box, plan] = await Promise.all([title.boundingBox(), sheet(page).boundingBox()]);
  expect(box!.x).toBeLessThan(page.viewportSize()!.width / 4);
  // Beside the plan, or over it on a phone; never on it.
  const beside = box!.x + box!.width <= plan!.x + 1;
  const over = box!.y + box!.height <= plan!.y + 1;
  expect(beside || over).toBe(true);
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

  test(`the sheet, the lift, the descent and the landing in ${theme}: WCAG AA, no console errors, broken images or overflow`, async ({
    page,
  }, testInfo) => {
    const errors = collectErrors(page);
    await page.emulateMedia({ colorScheme });
    await page.goto(url);
    for (const { id, name, progress } of phaseStops) {
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

  test("fades from the sheet to the walls up, to the door, and back, instead of moving", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await page.goto(url);
    await scrollModelTo(page, phaseStops[0].progress);
    await settle(page);
    const veil = model(page).locator("[data-model-veil]");
    for (const { id, progress } of [phaseStops[1], phaseStops[3], phaseStops[1], phaseStops[0]]) {
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
        /Planta baja, a \+0,00: salón\. Primera planta, a \+3,20: .*vuela 4\sm sobre el porche\./,
      );
      // Its levels and cotas, drawn as text: the chain and the whole, 10 m from the patio to the sea.
      for (const text of ["+0,00", "+3,20", "+6,40", "3,5 m", "10 m"]) {
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

const tour = tourStops(villaMarPlan);
/** The cartela of the stop on screen. */
const cartela = (page: Page) => model(page).locator("[data-tour-caption]");
/** «Parada 03 / 08». */
const counter = (stop: number) =>
  `Parada ${String(stop + 1).padStart(2, "0")} / ${String(tour.length).padStart(2, "0")}`;

/** The stop on screen, with its cartela and its number on the controls. */
async function expectStop(page: Page, stop: number) {
  await expect(model(page)).toHaveAttribute("data-model-stop", String(stop));
  const { name, area, orientation, line } = tour[stop]!.caption;
  await expect(cartela(page).getByRole("heading", { level: 3 })).toHaveText(name);
  await expect(cartela(page)).toContainText(`${area} · ${orientation}`);
  await expect(cartela(page)).toContainText(line);
  await expect(model(page).getByText(counter(stop), { exact: true })).toBeVisible();
}

test.describe("the tour", () => {
  test("walks its six stops with the scroll, each with its cartela, and back", async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto(url);
    // Before the tour, no stop and no controls.
    await scrollModelTo(page, phaseStops[2].progress);
    await expect(model(page)).not.toHaveAttribute("data-model-stop");
    await expect(model(page).getByRole("navigation", { name: "Paradas del tour" })).toHaveCount(0);
    const order = tour.map((_, i) => i);
    for (const stop of [...order, ...order.toReversed()]) {
      await scrollModelTo(page, stopProgress(stop, villaMarPlan));
      await expectStop(page, stop);
    }
    // The living room's figures, from the plan.
    await scrollModelTo(page, stopProgress(1, villaMarPlan));
    await expect(cartela(page)).toContainText("42\u00a0m²");
    expect(errors).toEqual([]);
  });

  test("goes from stop to stop with its buttons, the arrow keys and the locator", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await page.goto(url);
    await scrollModelTo(page, stopProgress(0, villaMarPlan));
    await expectStop(page, 0);
    const controls = model(page).getByRole("navigation", { name: "Paradas del tour" });
    await expect(controls.getByRole("button", { name: "Anterior" })).toBeDisabled();
    await controls.getByRole("button", { name: "Siguiente" }).click();
    await expectStop(page, 1);
    await page.keyboard.press("ArrowRight");
    await expectStop(page, 2);
    await page.keyboard.press("ArrowLeft");
    await expectStop(page, 1);
    const locator = model(page).getByRole("group", { name: "Localizador" });
    await expect(locator.getByRole("button")).toHaveCount(tour.length);
    await expect(locator.getByRole("button", { name: "Parada 2: Salón" })).toHaveAttribute(
      "aria-current",
      "step",
    );
    await locator.getByRole("button", { name: "Parada 6: Suite principal" }).click();
    await expectStop(page, 5);
    await expect(controls.getByRole("button", { name: "Siguiente" })).toBeDisabled();
    await controls.getByRole("button", { name: "Anterior" }).click();
    await expectStop(page, 4);
    expect(errors).toEqual([]);
  });

  test("its cartela is a live region: readers hear each stop as it changes", async ({ page }) => {
    await page.goto(url);
    // In the page before the tour, empty, so the first stop is announced when it arrives.
    await expect(cartela(page)).toHaveAttribute("aria-live", "polite");
    await expect(cartela(page)).toHaveText("");
    await scrollModelTo(page, stopProgress(4, villaMarPlan));
    await expect(cartela(page)).toContainText("Escalera");
  });

  for (const colorScheme of ["light", "dark"] as const) {
    const theme = colorScheme === "light" ? "dia" : "noche";

    test(`each stop in ${theme}: WCAG AA, no console errors, broken images or overflow`, async ({
      page,
    }, testInfo) => {
      test.setTimeout(90_000);
      const errors = collectErrors(page);
      await page.emulateMedia({ colorScheme });
      await page.goto(url);
      for (const [stop, { room }] of tour.entries()) {
        await scrollModelTo(page, stopProgress(stop, villaMarPlan));
        await expectStop(page, stop);
        await settle(page);
        const { violations } = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
          .include("section[data-model-phase]")
          .analyze();
        expect(
          violations.map(({ id, nodes }) => `${id}: ${nodes.map((n) => n.target).join(" | ")}`),
        ).toEqual([]);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow).toBe(0);
        if (capture) {
          await page.screenshot({
            path: `docs/screenshots/phase-3/house-tour-${String(stop + 1).padStart(2, "0")}-${room.id}-${testInfo.project.name}-${theme}.png`,
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

    test("fades from stop to stop, without the camera's way between them", async ({ page }) => {
      const errors = collectErrors(page);
      await page.goto(url);
      await scrollModelTo(page, stopProgress(0, villaMarPlan));
      await settle(page);
      await expectStop(page, 0);
      const veil = model(page).locator("[data-model-veil]");
      const controls = model(page).getByRole("navigation", { name: "Paradas del tour" });
      await controls.getByRole("button", { name: "Siguiente" }).click();
      // The scene goes out, takes the next stop, and comes back in.
      await expect(veil).toHaveAttribute("data-model-veil", "out");
      await expectStop(page, 1);
      await expect(veil).toHaveAttribute("data-model-veil", "in");
      // Between two phaseStops, the scroll shows one or the other, never the way between.
      const between = (stopProgress(1, villaMarPlan) + stopProgress(2, villaMarPlan)) / 2;
      await scrollModelTo(page, between - 0.005);
      await expect(veil).toHaveAttribute("data-model-veil", "in");
      await expectStop(page, 1);
      expect(errors).toEqual([]);
    });
  });
});
