import AxeBuilder from "@axe-core/playwright";
import * as THREE from "three";

import { expect, test, type Page } from "./fixtures";

import {
  floorView,
  phaseBounds,
  stopProgress,
} from "../src/app/(site)/casas/[slug]/_lib/model-choreography";
import { floorViews } from "../src/app/(site)/casas/[slug]/_lib/floor-views";
import {
  canEnter,
  floorLevel,
  roomCaption,
  tourStops,
} from "../src/app/(site)/casas/[slug]/_lib/tour";
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

test("while the scene loads, the sheet shows as its drawing, until the scene has drawn it", async ({
  page,
}) => {
  const errors = collectErrors(page);
  // The scene's chunk, the one with Three.js's renderer, held back: the scene never comes.
  await page.route("**/_next/static/chunks/*.js", async (route) => {
    const response = await route.fetch();
    if ((await response.text()).includes("WebGLRenderer")) return;
    await route.fulfill({ response });
  });
  // The held chunk can be asked for before the page's load event, which then never comes.
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await scrollModelTo(page, 0);
  const poster = model(page).locator("[data-model-poster]");
  await expect(poster).toHaveAttribute("data-model-poster", "in");
  // One version shown, for the theme and the screen, and loaded.
  const shown = poster.locator("img:visible");
  await expect(shown).toHaveCount(1);
  await expect
    .poll(() => shown.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth))
    .toBeGreaterThan(0);
  // The ground floor's plan, drawn: its rooms named on it.
  const svg = await (await page.request.get((await shown.getAttribute("src"))!)).text();
  expect(svg).toMatch(/^<svg[^>]*viewBox=/);
  expect(svg).toMatch(/>sal[oó]n</i);
  // Centred on the area the scene frames, reaching half the area past it on every side.
  const [area, drawn] = await Promise.all([sheet(page).boundingBox(), shown.boundingBox()]);
  expect(drawn!.width).toBeCloseTo(area!.width * 2, 0);
  expect(drawn!.height).toBeCloseTo(area!.height * 2, 0);
  expect(drawn!.x + drawn!.width / 2).toBeCloseTo(area!.x + area!.width / 2, 0);
  expect(drawn!.y + drawn!.height / 2).toBeCloseTo(area!.y + area!.height / 2, 0);
  await expect(model(page)).not.toHaveAttribute("data-model-ready");
  expect(errors).toEqual([]);
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

test("the sheet's drawing gives way to the scene once it has drawn", async ({ page }) => {
  await page.goto(url);
  await scrollModelTo(page, 0);
  await settle(page);
  await expect(model(page).locator("[data-model-poster]")).toHaveAttribute(
    "data-model-poster",
    "out",
  );
  await expect(model(page).locator("[data-model-poster]")).toHaveCSS("opacity", "0");
});

test("loads each floor's furniture when it is about to be seen, not before the first paint", async ({
  page,
}, testInfo) => {
  const requested: string[] = [];
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith("/media/furniture/")) requested.push(path);
  });
  await page.goto(url);
  await scrollModelTo(page, middle("sheet"));
  await settle(page);
  // On the sheet, the ground floor's and the plot's; the shelves stand only on the first floor.
  const version = testInfo.project.name === "mobile" ? ".mobile.glb" : ".glb";
  expect(requested.some((path) => path.endsWith(`armchair${version}`))).toBe(true);
  expect(requested.some((path) => path.includes("/shelves"))).toBe(false);
  // Each in its own version: a phone never loads the desktop's.
  expect(
    requested.every((path) => path.endsWith(".mobile.glb") === (version === ".mobile.glb")),
  ).toBe(true);
  await scrollModelTo(page, 1);
  await expect.poll(() => requested.some((path) => path.includes("/shelves"))).toBe(true);
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

const views = floorViews(villaMarPlan).floors;
/** The whole house's floors' buttons. */
const floorButtons = (page: Page) =>
  model(page).locator("[data-floor-picker]").getByRole("group", { name: "Plantas" });
/** The primary buttons on screen: there is one to a view. */
async function primaryOnScreen(page: Page) {
  return page.locator('[data-slot="button"][data-variant="default"]').evaluateAll((buttons) =>
    buttons
      .filter((button) => {
        const { top, bottom, width } = button.getBoundingClientRect();
        return width > 0 && bottom > 0 && top < window.innerHeight;
      })
      .map((button) => button.textContent?.trim()),
  );
}

test.describe("the whole house and its floors", () => {
  test("«Ir a las plantas» goes from the tour to the whole house, its floors' buttons focused", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await page.goto(url);
    await scrollModelTo(page, stopProgress(1, villaMarPlan));
    await expectStop(page, 1);
    await model(page).getByRole("button", { name: "Ir a las plantas" }).click();
    await expect(model(page)).toHaveAttribute("data-model-phase", "finale");
    const buttons = floorButtons(page).getByRole("button");
    await expect(buttons).toHaveText(["Exterior", "Planta baja", "Primera planta", "Azotea"]);
    for (const button of await buttons.all()) {
      await expect(button).toHaveAttribute("aria-pressed", "false");
    }
    await expect(model(page).getByRole("heading", { name: "La casa entera" })).toBeVisible();
    await expect(buttons.first()).toBeFocused();
    expect(await primaryOnScreen(page)).toEqual(["Reservar visita"]);
    await expect(model(page).getByRole("link", { name: "Reservar visita" })).toHaveAttribute(
      "href",
      "/#visita",
    );
    expect(errors).toEqual([]);
  });

  test("picks each floor, pressed, with its rooms; «Ver la casa entera» goes back", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await page.goto(url);
    await scrollModelTo(page, 1);
    await settle(page);
    for (const view of views) {
      const button = floorButtons(page).getByRole("button", { name: view.name, exact: true });
      await button.click();
      await expect(button).toHaveAttribute("aria-pressed", "true");
      await expect(model(page)).toHaveAttribute("data-model-phase", "floor");
      await expect(model(page)).toHaveAttribute("data-model-floor", view.id);
      const list = model(page).getByRole("list", { name: view.name });
      await expect(list.getByRole("listitem")).toHaveCount(view.geometry.rooms.length);
      await expect(floorButtons(page).getByRole("button", { pressed: true })).toHaveCount(1);
      expect(await primaryOnScreen(page)).toEqual(["Reservar visita"]);
    }
    await model(page).getByRole("button", { name: "Ver la casa entera" }).click();
    await expect(model(page)).toHaveAttribute("data-model-phase", "finale");
    await expect(model(page)).not.toHaveAttribute("data-model-floor");
    await expect(floorButtons(page).getByRole("button", { pressed: true })).toHaveCount(0);
    await expect(model(page).getByRole("button", { name: "Ver la casa entera" })).toHaveCount(0);
    await expect(floorButtons(page).getByRole("button").first()).toBeFocused();
    expect(errors).toEqual([]);
  });

  test("its rooms' list goes with the keyboard, each room lit as it is focused", async ({
    page,
  }) => {
    await page.goto(url);
    await scrollModelTo(page, 1);
    await settle(page);
    await floorButtons(page).getByRole("button", { name: "Planta baja" }).click();
    const list = model(page).getByRole("list", { name: "Planta baja" });
    const [first, second] = views.find(({ id }) => id === "ground")!.geometry.rooms;
    await list.getByRole("button").first().focus();
    await expect(model(page)).toHaveAttribute("data-model-room", first!.id);
    await page.keyboard.press("Tab");
    await expect(list.getByRole("button").nth(1)).toBeFocused();
    await expect(model(page)).toHaveAttribute("data-model-room", second!.id);
    await expect(list.getByRole("listitem").nth(1)).toHaveAttribute("data-pointed", "true");
  });

  test("scrolling back up leaves the floor picked for the tour", async ({ page }) => {
    await page.goto(url);
    await scrollModelTo(page, 1);
    await settle(page);
    await floorButtons(page).getByRole("button", { name: "Primera planta" }).click();
    await expect(model(page)).toHaveAttribute("data-model-floor", "first");
    await scrollModelTo(page, stopProgress(2, villaMarPlan));
    await expectStop(page, 2);
    await expect(model(page)).not.toHaveAttribute("data-model-floor");
  });

  for (const colorScheme of ["light", "dark"] as const) {
    const theme = colorScheme === "light" ? "dia" : "noche";

    test(`the whole house and each floor in ${theme}: WCAG AA, no console errors or overflow`, async ({
      page,
    }, testInfo) => {
      test.setTimeout(240_000);
      const errors = collectErrors(page);
      await page.emulateMedia({ colorScheme });
      await page.goto(url);
      await scrollModelTo(page, 1);
      await settle(page);
      const check = async (name: string) => {
        const { violations } = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
          .include("section[data-model-phase]")
          .analyze();
        expect(
          violations.map(({ id, nodes }) => `${id}: ${nodes.map((n) => n.target).join(" | ")}`),
          name,
        ).toEqual([]);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, name).toBe(0);
      };
      const shot = async (name: string) => {
        if (!capture) return;
        await page.screenshot({
          path: `docs/screenshots/phase-3/house-floors-${name}-${testInfo.project.name}-${theme}.png`,
        });
      };
      await check("whole");
      await shot("whole");
      for (const view of views) {
        await floorButtons(page).getByRole("button", { name: view.name, exact: true }).click();
        await expect(model(page)).toHaveAttribute("data-model-floor", view.id);
        // Over the floor, drawn: its rooms still in ink, its axes and dimensions round them.
        await page.waitForTimeout(1700);
        await shot(`${view.id}-drawn`);
        // Swept into 3D.
        await page.waitForTimeout(2500);
        await check(view.id);
        await shot(view.id);
      }
      expect(errors).toEqual([]);
    });
  }

  test.describe("with reduced motion", () => {
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
    });

    test("fades to a floor picked and back to the whole house", async ({ page }) => {
      const errors = collectErrors(page);
      await page.goto(url);
      await scrollModelTo(page, 1);
      await settle(page);
      const veil = model(page).locator("[data-model-veil]");
      await floorButtons(page).getByRole("button", { name: "Azotea" }).click();
      await expect(veil).toHaveAttribute("data-model-veil", "out");
      await expect(model(page)).toHaveAttribute("data-model-floor", "roof");
      await expect(veil).toHaveAttribute("data-model-veil", "in");
      await model(page).getByRole("button", { name: "Ver la casa entera" }).click();
      await expect(veil).toHaveAttribute("data-model-veil", "out");
      await expect(model(page)).toHaveAttribute("data-model-phase", "finale");
      await expect(veil).toHaveAttribute("data-model-veil", "in");
      expect(errors).toEqual([]);
    });
  });
});

/** Where the middle of a room of a picked floor is on the screen, as the scene frames the floor. */
async function roomOnScreen(page: Page, floorId: string, roomId: string) {
  const { width, height, area } = await model(page).evaluate((section) => {
    const canvas = section.querySelector("canvas")!.getBoundingClientRect();
    const floor = section.querySelector("[data-floor-area]")!.getBoundingClientRect();
    return {
      width: canvas.width,
      height: canvas.height,
      area: {
        x: (floor.left - canvas.left) / canvas.width,
        y: (floor.top - canvas.top) / canvas.height,
        width: floor.width / canvas.width,
        height: floor.height / canvas.height,
      },
    };
  });
  const { camera: pose } = floorView(villaMarPlan, floorId, {
    screen: { aspect: width / height, area },
  });
  const camera = new THREE.PerspectiveCamera(pose.fov, width / height, 0.1, 2000);
  camera.position.set(pose.position.x, pose.position.y, pose.position.z);
  camera.lookAt(pose.target.x, pose.target.y, pose.target.z);
  camera.updateMatrixWorld();
  const room = villaMarPlan.floors
    .find(({ id }) => id === floorId)!
    .rooms.find(({ id }) => id === roomId)!;
  const point = new THREE.Vector3(
    room.x + room.w / 2,
    floorLevel(villaMarPlan, floorId),
    room.z + room.d / 2,
  ).project(camera);
  return { x: ((point.x + 1) / 2) * width, y: ((1 - point.y) / 2) * height };
}

/** A room of Villa Mar, its floor and its cartela. */
const roomOf = (floorId: string, roomId: string) => {
  const floor = villaMarPlan.floors.find(({ id }) => id === floorId)!;
  const room = floor.rooms.find(({ id }) => id === roomId)!;
  return { floor, room, caption: roomCaption(villaMarPlan, floor, room) };
};

/** Every room that can be gone into, floor by floor. */
const enterable = villaMarPlan.floors.flatMap((floor) =>
  floor.rooms.filter(canEnter).map((room) => ({ floor, room })),
);

/** The whole house at the end of the scroll, a floor picked from it and landed. */
async function pickFloor(page: Page, name: string) {
  await page.goto(url);
  await scrollModelTo(page, 1);
  await settle(page);
  await floorButtons(page).getByRole("button", { name, exact: true }).click();
  // The camera's move and the sweep.
  await page.waitForTimeout(3800);
}

/** The cartela inside a room. */
const roomCartela = (page: Page) => model(page).locator('[data-room-caption="entered"]');
const back = (page: Page) => model(page).getByRole("button", { name: "Volver a la planta" });

/** Inside a room: the phase, its cartela with its figures and «Volver a la planta» focused. */
async function expectInside(page: Page, floorId: string, roomId: string) {
  const { caption } = roomOf(floorId, roomId);
  await expect(model(page)).toHaveAttribute("data-model-phase", "room");
  await expect(model(page)).toHaveAttribute("data-model-room", roomId);
  await expect(roomCartela(page).getByRole("heading", { level: 3 })).toHaveText(caption.name);
  await expect(roomCartela(page)).toContainText(`${caption.area} · ${caption.orientation}`);
  await expect(back(page)).toBeFocused();
  await expect(model(page).locator("[data-floor-picker]")).toHaveCount(0);
}

test.describe("a room of a picked floor", () => {
  test("lights as the mouse points at it, with a pointer and its cartela; a click goes in, «Volver a la planta» comes out", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "a mouse");
    const errors = collectErrors(page);
    await pickFloor(page, "Planta baja");
    const { x, y } = await roomOnScreen(page, "ground", "salon");
    await page.mouse.move(x, y);
    await expect(model(page)).toHaveAttribute("data-model-room", "salon");
    const canvas = model(page).locator("canvas");
    expect(await canvas.evaluate((element) => getComputedStyle(element).cursor)).toBe("pointer");
    const pointed = model(page).locator('[data-room-caption="pointed"]');
    await expect(pointed.getByRole("heading", { level: 3, includeHidden: true })).toHaveText(
      "Salón",
    );
    await expect(
      model(page).getByRole("list", { name: "Planta baja" }).getByRole("listitem").filter({
        hasText: "Salón",
      }),
    ).toHaveAttribute("data-pointed", "true");
    if (capture) {
      await page.screenshot({ path: "docs/screenshots/phase-3/house-room-pointed-desktop.png" });
    }
    // Off the rooms, no pointer.
    await page.mouse.move(5, 450);
    expect(await canvas.evaluate((element) => getComputedStyle(element).cursor)).not.toBe(
      "pointer",
    );
    await page.mouse.click(x, y);
    await expectInside(page, "ground", "salon");
    await back(page).click();
    await expect(model(page)).toHaveAttribute("data-model-phase", "floor");
    await expect(model(page)).toHaveAttribute("data-model-floor", "ground");
    await expect(model(page).getByRole("button", { name: /^Entrar en Salón/ })).toBeFocused();
    expect(errors).toEqual([]);
  });

  test("on a phone, a first tap lights it and shows its cartela, and a second goes in", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "a finger");
    const errors = collectErrors(page);
    await pickFloor(page, "Primera planta");
    const { x, y } = await roomOnScreen(page, "first", "suite");
    await page.touchscreen.tap(x, y);
    await expect(model(page)).toHaveAttribute("data-model-room", "suite");
    await expect(model(page)).toHaveAttribute("data-model-phase", "floor");
    // In the floor's panel, clear of the scene.
    const pointed = model(page).locator('[data-floor-picker] [data-room-caption="pointed"]');
    await expect(pointed).toContainText("Suite principal");
    await expect(pointed).toContainText("Vuelve a tocar para entrar");
    if (capture) {
      await page.screenshot({ path: "docs/screenshots/phase-3/house-room-pointed-mobile.png" });
    }
    await page.touchscreen.tap(x, y);
    await expectInside(page, "first", "suite");
    await back(page).tap();
    await expect(model(page)).toHaveAttribute("data-model-phase", "floor");
    await expect(
      model(page).getByRole("button", { name: /^Entrar en Suite principal/ }),
    ).toBeFocused();
    expect(errors).toEqual([]);
  });

  test("from the list, Intro goes in and Escape comes out, back to the room in the list", async ({
    page,
  }) => {
    await pickFloor(page, "Azotea");
    const room = model(page).getByRole("button", { name: /^Entrar en Solárium/ });
    await room.focus();
    await expect(room).toHaveCSS("cursor", "pointer");
    await page.keyboard.press("Enter");
    await expectInside(page, "roof", "solarium");
    await page.keyboard.press("Escape");
    await expect(model(page)).toHaveAttribute("data-model-phase", "floor");
    await expect(model(page)).toHaveAttribute("data-model-floor", "roof");
    await expect(room).toBeFocused();
    // The garden is the plot round the house: listed, not gone into.
    await floorButtons(page).getByRole("button", { name: "Exterior" }).click();
    const list = model(page).getByRole("list", { name: "Exterior" });
    await expect(list.getByRole("listitem").filter({ hasText: "Jardín" })).toBeVisible();
    await expect(list.getByRole("button", { name: /Jardín/ })).toHaveCount(0);
  });

  for (const colorScheme of ["light", "dark"] as const) {
    const theme = colorScheme === "light" ? "dia" : "noche";

    test(`inside a room in ${theme}: WCAG AA, no console errors or overflow`, async ({ page }) => {
      const errors = collectErrors(page);
      await page.emulateMedia({ colorScheme });
      await pickFloor(page, "Planta baja");
      await model(page)
        .getByRole("button", { name: /^Entrar en Cocina/ })
        .click();
      await expectInside(page, "ground", "cocina");
      await page.waitForTimeout(3200);
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
      expect(await primaryOnScreen(page)).toEqual([]);
      expect(errors).toEqual([]);
    });
  }

  test("each of the 26 rooms from its viewpoint", async ({ page }, testInfo) => {
    test.skip(!capture, "only for `npm run screenshots`");
    test.setTimeout(600_000);
    expect(enterable).toHaveLength(26);
    let picked: string | null = null;
    // `ROOMS=aseo,vestidor` captures only those, to review a view set by hand.
    const only = process.env.ROOMS?.split(",");
    for (const { floor, room } of enterable) {
      if (only && !only.includes(room.id)) continue;
      if (picked !== floor.id) {
        if (picked === null) await pickFloor(page, floor.name);
        else {
          await floorButtons(page).getByRole("button", { name: floor.name, exact: true }).click();
          await page.waitForTimeout(3800);
        }
        picked = floor.id;
      }
      await model(page)
        .getByRole("button", { name: new RegExp(`^Entrar en ${room.name}`) })
        .click();
      await expectInside(page, floor.id, room.id);
      await page.waitForTimeout(3400);
      await page.screenshot({
        path: `docs/screenshots/phase-3/house-room-${floor.id}-${room.id}-${testInfo.project.name}.png`,
      });
      await page.keyboard.press("Escape");
      await expect(model(page)).toHaveAttribute("data-model-phase", "floor");
      await page.waitForTimeout(1200);
    }
  });

  test.describe("with reduced motion", () => {
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
    });

    test("fades into a room and back out over its floor", async ({ page }) => {
      const errors = collectErrors(page);
      await page.goto(url);
      await scrollModelTo(page, 1);
      await settle(page);
      const veil = model(page).locator("[data-model-veil]");
      await floorButtons(page).getByRole("button", { name: "Primera planta" }).click();
      await expect(veil).toHaveAttribute("data-model-veil", "in");
      await model(page)
        .getByRole("button", { name: /^Entrar en Suite principal/ })
        .click();
      await expect(veil).toHaveAttribute("data-model-veil", "out");
      await expectInside(page, "first", "suite");
      await expect(veil).toHaveAttribute("data-model-veil", "in");
      await page.keyboard.press("Escape");
      await expect(veil).toHaveAttribute("data-model-veil", "out");
      await expect(model(page)).toHaveAttribute("data-model-phase", "floor");
      await expect(veil).toHaveAttribute("data-model-veil", "in");
      expect(errors).toEqual([]);
    });
  });
});
