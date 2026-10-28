import { expect, test } from "@playwright/test";

test("landing loads in Spanish with the Calma Costa title and no errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("requestfailed", (request) => errors.push(`Request failed: ${request.url()}`));
  page.on("response", (response) => {
    if (response.status() >= 400) errors.push(`${response.status()}: ${response.url()}`);
  });

  await page.goto("/");

  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await expect(page).toHaveTitle(/Calma Costa/);
  await expect(page.getByRole("heading", { level: 1, name: "Calma Costa" })).toBeVisible();

  await page.waitForLoadState("networkidle");
  expect(errors).toEqual([]);
});
