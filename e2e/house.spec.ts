import { expect, test } from "./fixtures";

import { availabilityLabel, offerLabel } from "../src/features/houses/catalog";
import { formatPrice } from "../src/lib/format";

import { headerIsTransparent } from "./header";
import { waitForImage } from "./hero";
import { houseTypes } from "./houses";

for (const { slug, name, title, statement, floors, hasTour, availability } of houseTypes) {
  test.describe(name, () => {
    const url = `/casas/${slug}`;

    test("opens on its hero at full screen, under the transparent header", async ({ page }) => {
      const response = await page.goto(url);
      expect(response?.status()).toBe(200);

      const hero = page.getByRole("region", { name, exact: true });
      await expect(hero).toBeInViewport({ ratio: 0.9 });
      await waitForImage(hero.locator("img"));
      expect(await headerIsTransparent(page)).toBe(true);
    });

    test("presents the house: name, statement, figures and offer", async ({ page }) => {
      await page.goto(url);

      await expect(page.getByRole("heading", { level: 1 })).toHaveAccessibleName(
        `${title.lead} ${title.accent}`,
      );
      await expect(page.getByText(statement.rest)).toBeVisible();
      const figures = page.getByRole("main").locator("dl");
      for (const label of ["construidos", "dormitorios", "baños", "de parcela"]) {
        await expect(figures.getByRole("term").filter({ hasText: label })).toBeVisible();
      }
      await expect(page.getByText(availabilityLabel(availability), { exact: true })).toBeVisible();
      if (availability.priceFrom === null) {
        await expect(page.getByText(/^Desde/)).toHaveCount(0);
      } else {
        await expect(page.getByText(`Desde ${formatPrice(availability.priceFrom)}`)).toBeVisible();
      }
    });

    test('has a single primary button, "Pedir visita", to the landing\'s visit section', async ({
      page,
    }) => {
      await page.goto(url);

      const primary = page.locator('[data-slot="button"][data-variant="default"]');
      await expect(primary).toHaveCount(1);
      await expect(primary).toHaveAccessibleName("Pedir visita");
      await expect(primary).toHaveAttribute("href", "/#visita");
      // Inside the presentation, not the header, which steps back to secondary here.
      await expect(page.getByRole("main").locator(primary)).toHaveCount(1);
    });

    test("walks its floors in order, each with its still and counter", async ({ page }) => {
      await page.goto(url);

      const stretches = page.getByRole("main").getByRole("article");
      await expect(stretches).toHaveCount(floors.length);
      const total = String(floors.length).padStart(2, "0");
      for (const [index, floor] of floors.entries()) {
        const stretch = stretches.nth(index);
        await expect(stretch).toHaveAccessibleName(floor.name);
        await expect(stretch).toContainText(`${String(index + 1).padStart(2, "0")} / ${total}`);
        await stretch.scrollIntoViewIfNeeded();
        await waitForImage(stretch.locator("img"));
      }
      await expect(page.getByText("Tour próximamente")).toHaveCount(hasTour ? 0 : floors.length);
    });

    test("has its own title, description and Open Graph image", async ({ page, request }) => {
      await page.goto(url);

      await expect(page).toHaveTitle(new RegExp(`^${name} · `));
      const offer = offerLabel(availability);
      await expect(page.locator('meta[name="description"]')).toHaveAttribute(
        "content",
        new RegExp(`${offer}\\.$`),
      );
      const image = await page.locator('meta[property="og:image"]').getAttribute("content");
      const response = await request.get(image ?? "");
      expect(response.status()).toBe(200);
      expect(response.headers()["content-type"]).toBe("image/png");
    });
  });
}

test("an unknown house answers the 404 inside the site layout", async ({ page }) => {
  const response = await page.goto("/casas/casa-faro");

  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Esta página se la llevó la marea",
  );
  await expect(page.getByRole("banner").getByRole("link", { name: "Costa Calma" })).toBeVisible();
  await expect(page.getByRole("contentinfo")).toBeVisible();
  // Not a house page: the header's "Pedir visita" stays the view's single primary button.
  await expect(page.locator('[data-slot="button"][data-variant="default"]')).toHaveCount(1);
});

test.describe("opened from a direct link", () => {
  test.use({ intro: "unseen" });

  test("shows the house without the loading intro", async ({ page }) => {
    await page.goto("/casas/villa-mar");

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator("[data-intro-overlay]")).toHaveCount(0);
    await expect(page.locator("html")).not.toHaveAttribute("data-intro");
  });
});
