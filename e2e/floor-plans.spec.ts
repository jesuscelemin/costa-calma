import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "./fixtures";

import { floorGeometry } from "../src/features/houses/plan";
import { formatArea } from "../src/lib/format";

import { houseTypes } from "./houses";
import { waitForRevealsToSettle } from "./reveal";

const compass = { north: "norte", south: "sur", east: "este", west: "oeste" } as const;

const floorButtons = (page: Page) =>
  page.getByRole("group", { name: "Plantas", exact: true }).getByRole("button");

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

for (const { slug, name, plan } of houseTypes) {
  test.describe(name, () => {
    const url = `/casas/${slug}`;

    test("opens the plans on the ground floor", async ({ page }) => {
      await page.goto(url);
      await expect(floorButtons(page)).toHaveText(plan.floors.map((floor) => floor.name));
      await expect(floorButtons(page).filter({ hasText: "Planta baja" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    });

    test("picking each floor with its button shows its plan and its rooms", async ({ page }) => {
      await page.goto(url);
      const plans = page.getByRole("region", { name: `Planos de ${name}` });

      for (const floor of plan.floors) {
        await floorButtons(page)
          .filter({ hasText: new RegExp(`^${floor.name}$`) })
          .click();

        for (const other of plan.floors) {
          await expect(
            floorButtons(page).filter({ hasText: new RegExp(`^${other.name}$`) }),
          ).toHaveAttribute("aria-pressed", String(other.id === floor.id));
        }
        await expect(
          plans.getByRole("img", { name: `Plano de ${floor.name.toLowerCase()}` }),
        ).toBeVisible();

        const rooms = plans.getByRole("list", { name: floor.name }).getByRole("listitem");
        await expect(rooms).toHaveCount(floor.rooms.length);
        for (const [index, room] of floorGeometry(floor, plan).rooms.entries()) {
          await expect(rooms.nth(index)).toContainText(room.name);
          await expect(rooms.nth(index)).toContainText(formatArea(room.area));
          await expect(rooms.nth(index)).toContainText(
            `Orientación ${room.orientation.toLowerCase()}`,
          );
        }
      }
    });

    test("the floor buttons work from the keyboard", async ({ page }) => {
      await page.goto(url);
      const last = plan.floors.length - 1;
      await floorButtons(page).first().focus();
      for (let index = 1; index <= last; index++) {
        await page.keyboard.press("Tab");
        await expect(floorButtons(page).nth(index)).toBeFocused();
      }
      await page.keyboard.press("Enter");
      await expect(floorButtons(page).nth(last)).toHaveAttribute("aria-pressed", "true");
      for (let index = last; index > 0; index--) await page.keyboard.press("Shift+Tab");
      await page.keyboard.press("Space");
      await expect(floorButtons(page).first()).toHaveAttribute("aria-pressed", "true");
      await expect(
        page
          .getByRole("region", { name: `Planos de ${name}` })
          .getByRole("heading", { level: 3, name: plan.floors[0]!.name }),
      ).toBeVisible();
    });

    for (const colorScheme of ["light", "dark"] as const) {
      test(`every floor's plan passes WCAG AA in ${colorScheme === "light" ? "Día" : "Noche"}`, async ({
        page,
      }) => {
        await page.emulateMedia({ colorScheme });
        await page.goto(url);
        const plans = page.getByRole("region", { name: `Planos de ${name}` });
        await plans.scrollIntoViewIfNeeded();
        await waitForRevealsToSettle(page);

        for (const floor of plan.floors) {
          await floorButtons(page)
            .filter({ hasText: new RegExp(`^${floor.name}$`) })
            .click();
          const { violations } = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
            .include(`section[aria-label="Planos de ${name}"]`)
            .analyze();
          expect(
            violations.map(({ id, nodes }) => `${id}: ${nodes.map((n) => n.target).join(" | ")}`),
            floor.name,
          ).toEqual([]);
        }
      });
    }

    const { partyWall } = plan;
    if (partyWall) {
      test("shows the neighbour beyond the party wall on every floor", async ({ page }) => {
        await page.goto(url);
        const plans = page.getByRole("region", { name: `Planos de ${name}` });
        for (const floor of plan.floors) {
          await floorButtons(page)
            .filter({ hasText: new RegExp(`^${floor.name}$`) })
            .click();
          await expect(plans.getByText("Vivienda vecina")).toBeAttached();
          await expect(plans.locator("figcaption")).toContainText(
            `medianera al ${compass[partyWall]}`,
          );
        }
      });
    }

    test("the plan fits the screen, with no horizontal scroll", async ({ page }) => {
      await page.goto(url);
      await page.getByRole("region", { name: `Planos de ${name}` }).scrollIntoViewIfNeeded();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    });
  });
}
