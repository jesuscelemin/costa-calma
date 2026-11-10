import { expect, test, type Page } from "./fixtures";
import { collectErrors, expectAccessible, model, scrollModelTo, settle } from "./house-model";

import { floorViews } from "../src/app/(site)/casas/[slug]/_lib/floor-views";
import { phaseBounds, stopProgress } from "../src/app/(site)/casas/[slug]/_lib/model-choreography";
import { canEnter, tourStops } from "../src/app/(site)/casas/[slug]/_lib/tour";
import { catalogData } from "../src/features/houses/data";

// Casa Pinar and Casa Olivo walked through with the same engine as Villa Mar (#41), from their
// plans alone: the sheet, the tour, the whole house, each floor and a room. Villa Mar's own spec,
// house-model.spec.ts, goes into every detail of the engine; this one checks each house's data
// drives it. `npm run screenshots` saves each phase, stop and floor under docs/screenshots.

const capture = process.env.CAPTURE_SCREENSHOTS === "1";

const houses = catalogData.houseTypes.filter(({ slug }) => slug !== "villa-mar");

/** The whole house's floors' buttons. */
const floorButtons = (page: Page) =>
  model(page).locator("[data-floor-picker]").getByRole("group", { name: "Plantas" });

for (const { slug, name, plan, sheetHeading } of houses) {
  const url = `/casas/${slug}`;
  const stops = tourStops(plan);
  const views = floorViews(plan).floors;
  const enterable = plan.floors.flatMap((floor) =>
    floor.rooms.filter(canEnter).map((room) => ({ floor, room })),
  );
  const number = (stop: number) => String(stop + 1).padStart(2, "0");
  const counter = (stop: number) =>
    `Parada ${number(stop)} / ${String(stops.length).padStart(2, "0")}`;

  /** The stop on screen, with its cartela and its number on the controls. */
  async function expectStop(page: Page, stop: number) {
    await expect(model(page)).toHaveAttribute("data-model-stop", String(stop));
    const cartela = model(page).locator("[data-tour-caption]");
    const { name: room, area, orientation, line } = stops[stop]!.caption;
    await expect(cartela.getByRole("heading", { level: 3 })).toHaveText(room);
    await expect(cartela).toContainText(`${area} · ${orientation}`);
    await expect(cartela).toContainText(line);
    await expect(
      model(page).getByText(counter(stop), { exact: true }).filter({ visible: true }),
    ).toBeVisible();
  }

  const shot = async (page: Page, file: string) => {
    if (capture) await page.screenshot({ path: `docs/screenshots/phase-3/${slug}-${file}.png` });
  };

  test.describe(name, () => {
    test("starts on its sheet, under its own title, and none of the 2D floors' stretches", async ({
      page,
    }) => {
      const errors = collectErrors(page);
      await page.goto(url);
      await expect(
        model(page).getByRole("heading", {
          level: 2,
          name: `${sheetHeading.lead} ${sheetHeading.accent}`,
        }),
      ).toBeVisible();
      await expect(model(page).getByText(sheetHeading.line)).toBeVisible();
      await expect(
        model(page).getByRole("img", { name: `Plano de la planta baja de ${name}` }),
      ).toBeAttached();
      await expect(page.getByText("Tour próximamente")).toHaveCount(0);
      await expect(page.getByRole("heading", { name: "Recorre la casa" })).toHaveCount(0);
      expect(errors).toEqual([]);
    });

    test(`walks its ${stops.length} stops with the scroll, the buttons and the arrow keys`, async ({
      page,
    }) => {
      const errors = collectErrors(page);
      await page.goto(url);
      for (const stop of stops.keys()) {
        await scrollModelTo(page, stopProgress(stop, plan));
        await expectStop(page, stop);
      }
      await scrollModelTo(page, stopProgress(0, plan));
      await expectStop(page, 0);
      const controls = model(page).getByRole("navigation", { name: "Paradas del tour" });
      await controls.getByRole("button", { name: "Siguiente" }).click();
      await expectStop(page, 1);
      await page.keyboard.press("ArrowRight");
      await expectStop(page, 2);
      await page.keyboard.press("ArrowLeft");
      await expectStop(page, 1);
      expect(errors).toEqual([]);
    });

    test("picks each floor, pressed, with its rooms; «Ver la casa entera» goes back", async ({
      page,
    }) => {
      const errors = collectErrors(page);
      await page.goto(url);
      await scrollModelTo(page, 1);
      await settle(page);
      await expect(floorButtons(page).getByRole("button")).toHaveText(
        views.map(({ name: floor }) => floor),
      );
      for (const view of views) {
        const button = floorButtons(page).getByRole("button", { name: view.name, exact: true });
        await button.click();
        await expect(button).toHaveAttribute("aria-pressed", "true");
        await expect(model(page)).toHaveAttribute("data-model-floor", view.id);
        const list = model(page).getByRole("list", { name: view.name });
        await expect(list.getByRole("listitem")).toHaveCount(view.geometry.rooms.length);
      }
      await model(page).getByRole("button", { name: "Ver la casa entera" }).click();
      await expect(model(page)).toHaveAttribute("data-model-phase", "finale");
      expect(errors).toEqual([]);
    });

    test(`goes into each of its ${enterable.length} rooms from the list and out: WCAG AA inside each`, async ({
      page,
    }, testInfo) => {
      test.setTimeout(300_000);
      const errors = collectErrors(page);
      await page.goto(url);
      await scrollModelTo(page, 1);
      await settle(page);
      let picked: string | null = null;
      for (const { floor, room } of enterable) {
        if (picked !== floor.id) {
          await floorButtons(page).getByRole("button", { name: floor.name, exact: true }).click();
          await expect(model(page)).toHaveAttribute("data-model-floor", floor.id);
          // The camera's move over the floor: a room entered before it lands is captured from there.
          await page.waitForTimeout(3800);
          picked = floor.id;
        }
        const entry = model(page).locator(`[data-room-button="${room.id}"]`);
        await entry.focus();
        await page.keyboard.press("Enter");
        await expect(model(page)).toHaveAttribute("data-model-phase", "room");
        await expect(model(page)).toHaveAttribute("data-model-room", room.id);
        await expect(model(page).getByRole("button", { name: "Volver a la planta" })).toBeFocused();
        // The camera's move into it and the sweep.
        await page.waitForTimeout(3400);
        await expectAccessible(page, room.id);
        await shot(page, `room-${floor.id}-${room.id}-${testInfo.project.name}`);
        await page.keyboard.press("Escape");
        await expect(model(page)).toHaveAttribute("data-model-phase", "floor");
        await expect(entry).toBeFocused();
      }
      expect(errors).toEqual([]);
    });

    for (const colorScheme of ["light", "dark"] as const) {
      const theme = colorScheme === "light" ? "dia" : "noche";

      test(`each phase, stop and floor in ${theme}: WCAG AA, no console errors or overflow`, async ({
        page,
      }, testInfo) => {
        test.setTimeout(300_000);
        const errors = collectErrors(page);
        const device = testInfo.project.name;
        await page.emulateMedia({ colorScheme });
        await page.goto(url);
        const phases = [
          ["sheet", (phaseBounds("sheet", plan).start + phaseBounds("sheet", plan).end) / 2],
          ["lift", phaseBounds("lift", plan).end - 0.005],
          ["descent", (phaseBounds("descent", plan).start + phaseBounds("descent", plan).end) / 2],
          ["landed", phaseBounds("tour", plan).start + 0.002],
        ] as const;
        for (const [phase, progress] of phases) {
          await scrollModelTo(page, progress);
          await settle(page);
          await expectAccessible(page, phase);
          await shot(page, `${phase}-${device}-${theme}`);
        }
        for (const [stop, { room }] of stops.entries()) {
          await scrollModelTo(page, stopProgress(stop, plan));
          await expectStop(page, stop);
          await settle(page);
          await expectAccessible(page, room.id);
          await shot(page, `tour-${number(stop)}-${room.id}-${device}-${theme}`);
        }
        await scrollModelTo(page, 1);
        await settle(page);
        await expectAccessible(page, "whole");
        await shot(page, `floors-whole-${device}-${theme}`);
        for (const view of views) {
          await floorButtons(page).getByRole("button", { name: view.name, exact: true }).click();
          await expect(model(page)).toHaveAttribute("data-model-floor", view.id);
          // Drawn, then swept into 3D.
          await page.waitForTimeout(4200);
          await expectAccessible(page, view.id);
          await shot(page, `floors-${view.id}-${device}-${theme}`);
        }
        expect(errors).toEqual([]);
      });
    }
  });
}
