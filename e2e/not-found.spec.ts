import { expect, test } from "./fixtures";

import { motto } from "./hero";

test("an unknown route shows the brand 404 with a link back to the landing", async ({ page }) => {
  const response = await page.goto("/esta-pagina-no-existe");

  expect(response?.status()).toBe(404);
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await expect(page.getByRole("img", { name: "Costa Calma" }).first()).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Esta página se la llevó la marea",
  );

  await page.getByRole("link", { name: "Volver a la portada" }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { level: 1, name: motto })).toBeVisible();
});

test("the 404 keeps the site header and footer, so navigation stays at hand", async ({ page }) => {
  const response = await page.goto("/casas/no-existe/tampoco");

  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Esta página se la llevó la marea",
  );
  await expect(page.getByRole("banner").getByRole("link", { name: "Costa Calma" })).toBeVisible();
  await expect(page.getByRole("contentinfo")).toBeVisible();
  // The fixed header must not cover the message.
  const header = await page.getByRole("banner").boundingBox();
  const eyebrow = await page.getByText("Error 404").boundingBox();
  expect(eyebrow!.y).toBeGreaterThanOrEqual(header!.y + header!.height);
});
