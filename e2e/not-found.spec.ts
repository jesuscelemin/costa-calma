import { expect, test } from "@playwright/test";

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
  await expect(page.getByRole("heading", { level: 1, name: "Costa Calma" })).toBeVisible();
});
