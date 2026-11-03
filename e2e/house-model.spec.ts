import { mkdirSync } from "node:fs";

import AxeBuilder from "@axe-core/playwright";
import sharp from "sharp";

import { expect, test, type Page } from "./fixtures";

import { modelPhases, phaseBounds } from "../src/app/(site)/casas/[slug]/_lib/model-choreography";
import { modelPoster } from "../src/features/houses/media";
import { floorGeometry } from "../src/features/houses/plan";

import { houseTypes } from "./houses";

// `npm run screenshots` saves each phase under docs/screenshots; `npm run media:model-posters`
// captures the posters the model shows while it loads.
const capture = process.env.CAPTURE_SCREENSHOTS === "1";
const capturePosters = process.env.CAPTURE_MODEL_POSTERS === "1";

const slug = "villa-mar";
const url = `/casas/${slug}`;

const { plan } = houseTypes.find((houseType) => houseType.slug === slug)!;

const model = (page: Page) => page.locator("section[data-model-phase]");
const floorButtons = (page: Page) =>
  model(page).getByRole("group", { name: "Plantas de la maqueta" }).getByRole("button");
const floorButton = (page: Page, name: string) =>
  floorButtons(page).filter({ hasText: new RegExp(`^${name}$`) });
/** The rooms the model labels: all but the stair and the voids. */
const labelled = (floor: (typeof plan.floors)[number]) =>
  floorGeometry(floor, plan).rooms.filter(({ kind }) => kind !== "stair" && kind !== "void");

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
  await expect(model(page).locator("article[data-active] h3")).toHaveText(
    "05 / 05 · La casa abierta",
  );
  for (const { id, progress } of stops.toReversed()) {
    await scrollModelTo(page, progress);
    await expect(model(page)).toHaveAttribute("data-model-phase", id);
  }
  await expect(model(page).locator("article[data-active] h3")).toHaveText("01 / 05 · La parcela");
  await settle(page);
  expect(errors).toEqual([]);
});

test("beside each phase, a figure of the house: from its plot to its bedrooms", async ({
  page,
}) => {
  await page.goto(url);
  const figure = model(page).locator("article[data-active] [data-model-figure]");
  await scrollModelTo(page, stops[0]!.progress);
  await expect(figure).toContainText("462 m²");
  await expect(figure).toContainText("piscina de 9 × 3,5 m");
  await scrollModelTo(page, stops.at(-1)!.progress);
  await expect(figure).toContainText("dormitorios y 3 baños");
});

test("the skip link jumps past the model to the tour of the house", async ({ page }) => {
  await page.goto(url);
  await model(page).getByRole("link", { name: "Saltar la maqueta" }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#recorre$/);
  await expect(page.getByRole("region", { name: "Recorre la casa" })).toBeInViewport();
});

/** Scrolls to the open house and waits for it to land. */
async function openHouse(page: Page) {
  await scrollModelTo(page, stops.at(-1)!.progress);
  await expect(model(page)).toHaveAttribute("data-model-phase", "open");
  await settle(page);
}

test.describe("picking a floor", () => {
  test("each floor's button shows it alone with its rooms, and «Ver todas las plantas» goes back", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await page.goto(url);
    await openHouse(page);
    await expect(floorButtons(page)).toHaveText(plan.floors.map(({ name }) => name));
    for (const button of await floorButtons(page).all()) {
      await expect(button).toHaveAttribute("aria-pressed", "false");
    }

    for (const floor of plan.floors) {
      await floorButton(page, floor.name).click();
      await expect(model(page)).toHaveAttribute("data-model-floor", floor.id);
      for (const other of plan.floors) {
        await expect(floorButton(page, other.name)).toHaveAttribute(
          "aria-pressed",
          String(other.id === floor.id),
        );
      }
      const rooms = model(page).getByRole("list", { name: floor.name }).getByRole("listitem");
      await expect(rooms).toHaveCount(floorGeometry(floor, plan).rooms.length);
      // Each room labelled on the model, by its name.
      const labels = model(page).locator("[data-room-label]");
      await expect(labels).toHaveCount(labelled(floor).length);
      for (const room of labelled(floor)) {
        await expect(labels.and(page.locator(`[data-room-label="${room.id}"]`))).toContainText(
          room.name,
        );
      }
    }

    await model(page).getByRole("button", { name: "Ver todas las plantas" }).click();
    await expect(model(page)).not.toHaveAttribute("data-model-floor");
    await expect(model(page).locator("[data-room-label]")).toHaveCount(0);
    await expect(model(page).locator("article[data-active] h3")).toHaveText(
      "05 / 05 · La casa abierta",
    );
    await expect(model(page).getByRole("button", { name: "Ver todas las plantas" })).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("pointing at a room in the list lights its label on the model", async ({ page }) => {
    await page.goto(url);
    await openHouse(page);
    const ground = plan.floors.find(({ kind }) => kind === "storey")!;
    await floorButton(page, ground.name).click();
    const [room] = labelled(ground);
    await model(page)
      .getByRole("list", { name: ground.name })
      .getByRole("listitem")
      .filter({ hasText: room!.name })
      .first()
      .hover();
    await expect(model(page).locator(`[data-room-label="${room!.id}"]`)).toHaveAttribute(
      "data-pointed",
    );
  });

  test("a floor of the open house is a link to the pointer, and a click picks it", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "No pointer to hover with on phones");
    await page.goto(url);
    await openHouse(page);
    const canvas = model(page).locator("canvas");
    const box = (await canvas.boundingBox())!;
    // The middle of the open house: one of its floors.
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await expect(canvas).toHaveCSS("cursor", "pointer");
    await page.mouse.down();
    await page.mouse.up();
    await expect(model(page)).toHaveAttribute("data-model-floor");
    const picked = await model(page).getAttribute("data-model-floor");
    const floor = plan.floors.find(({ id }) => id === picked)!;
    await expect(floorButton(page, floor.name)).toHaveAttribute("aria-pressed", "true");
  });

  test("the 3D · Plano switch shows the floor picked as its 2D plan, and back", async ({
    page,
  }) => {
    await page.goto(url);
    await openHouse(page);
    const views = model(page).getByRole("group", { name: "Vista de la planta" });
    // Only once a floor is picked.
    await expect(views).toHaveCount(0);
    for (const floor of plan.floors) {
      await floorButton(page, floor.name).click();
      await views.getByRole("button", { name: "Plano" }).click();
      await expect(views.getByRole("button", { name: "Plano" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await expect(
        model(page).getByRole("img", { name: `Plano de ${floor.name.toLowerCase()}` }),
      ).toBeVisible();
      await expect(model(page).locator("[data-model-plan]")).toHaveCSS("opacity", "1");
    }
    await views.getByRole("button", { name: "3D" }).click();
    await expect(views.getByRole("button", { name: "3D" })).toHaveAttribute("aria-pressed", "true");
    await expect(model(page).locator("[data-model-plan]")).toHaveCSS("opacity", "0");
    // The plan out of sight is out of reach too.
    await expect(model(page).getByRole("img", { name: /^Plano de/ })).toHaveCount(0);
  });

  test("scrolling back into the build closes the floor picked", async ({ page }) => {
    await page.goto(url);
    await openHouse(page);
    await floorButton(page, "Planta baja").click();
    await expect(model(page)).toHaveAttribute("data-model-floor", "ground");
    await scrollModelTo(page, stops[2]!.progress);
    await expect(model(page)).toHaveAttribute("data-model-phase", "walls");
    await scrollModelTo(page, stops.at(-1)!.progress);
    await expect(model(page)).toHaveAttribute("data-model-phase", "open");
    await expect(model(page)).not.toHaveAttribute("data-model-floor");
  });

  test("the floor buttons work from the keyboard", async ({ page }) => {
    await page.goto(url);
    await openHouse(page);
    await floorButtons(page).first().focus();
    await page.keyboard.press("Tab");
    await expect(floorButtons(page).nth(1)).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(floorButtons(page).nth(1)).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Space");
    await expect(floorButtons(page).first()).toHaveAttribute("aria-pressed", "true");
    await expect(model(page)).toHaveAttribute("data-model-floor", plan.floors[0]!.id);
  });

  for (const colorScheme of ["light", "dark"] as const) {
    const theme = colorScheme === "light" ? "dia" : "noche";

    test(`every floor picked passes WCAG AA in ${theme}, in 3D and as a plan, without errors or overflow`, async ({
      page,
    }, testInfo) => {
      // Two audits and a settle per floor.
      test.slow();
      const errors = collectErrors(page);
      await page.emulateMedia({ colorScheme });
      await page.goto(url);
      await openHouse(page);
      for (const floor of plan.floors) {
        await floorButton(page, floor.name).click();
        await expect(model(page)).toHaveAttribute("data-model-floor", floor.id);
        await settle(page);
        const { violations } = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
          .include("section[data-model-phase]")
          .analyze();
        expect(
          violations.map(({ id, nodes }) => `${id}: ${nodes.map((n) => n.target).join(" | ")}`),
          floor.name,
        ).toEqual([]);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow).toBe(0);
        if (capture) {
          await page.screenshot({
            path: `docs/screenshots/phase-3/house-model-floor-${floor.id}-${testInfo.project.name}-${theme}.png`,
          });
        }
        // And as its 2D plan.
        const views = model(page).getByRole("group", { name: "Vista de la planta" });
        await views.getByRole("button", { name: "Plano" }).click();
        await expect(model(page).locator("[data-model-plan]")).toHaveCSS("opacity", "1");
        const plain = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
          .include("section[data-model-phase]")
          .analyze();
        expect(
          plain.violations.map(
            ({ id, nodes }) => `${id}: ${nodes.map((n) => n.target).join(" | ")}`,
          ),
          `${floor.name}, plano`,
        ).toEqual([]);
        if (capture) {
          await page.screenshot({
            path: `docs/screenshots/phase-3/house-model-plan-${floor.id}-${testInfo.project.name}-${theme}.png`,
          });
        }
        await views.getByRole("button", { name: "3D" }).click();
      }
      expect(errors).toEqual([]);
    });
  }
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
    await expect(model(page).locator("article[data-active] h3")).toHaveText(
      "05 / 05 · La casa abierta",
    );
    await expect(model(page).locator("canvas")).toBeVisible();
    const height = await model(page).evaluate((section) => section.getBoundingClientRect().height);
    expect(height).toBeLessThan(page.viewportSize()!.height * 1.5);
  });

  test("a floor picked fades in, without a flight of the camera", async ({ page }) => {
    await page.goto(url);
    await model(page).scrollIntoViewIfNeeded();
    await expect(model(page)).toHaveAttribute("data-model-ready");
    const veil = model(page).locator("[data-model-veil]");
    await floorButton(page, "Primera planta").click();
    // The model goes out, the floor comes in.
    await expect(veil).toHaveAttribute("data-model-veil", "out");
    await expect(model(page)).toHaveAttribute("data-model-floor", "first");
    await expect(veil).toHaveAttribute("data-model-veil", "in");
    await expect(model(page).getByRole("list", { name: "Primera planta" })).toBeVisible();
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
    // Its button pressed, and the others show their own plan.
    await expect(floorButton(page, "Planta baja")).toHaveAttribute("aria-pressed", "true");
    await floorButton(page, "Primera planta").click();
    await expect(model(page).getByRole("img", { name: "Plano de primera planta" })).toBeVisible();
    await expect(floorButton(page, "Planta baja")).toHaveAttribute("aria-pressed", "false");
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
