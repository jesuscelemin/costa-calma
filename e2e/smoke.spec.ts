import { expect, test } from "@playwright/test";

test("landing loads in Spanish with the Costa Calma title and no errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("requestfailed", (request) => {
    // In development Strict Mode mounts the flight twice, and the page itself aborts the first
    // load of its clip: that cancellation is not a failure. Anything else still is.
    const aborted = request.failure()?.errorText === "net::ERR_ABORTED";
    if (aborted && new URL(request.url()).pathname.startsWith("/media/")) return;
    errors.push(`Request failed: ${request.url()}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) errors.push(`${response.status()}: ${response.url()}`);
  });

  await page.goto("/");

  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await expect(page).toHaveTitle(/Costa Calma/);
  await expect(page.getByRole("heading", { level: 1, name: "Costa Calma" })).toBeVisible();

  await page.waitForLoadState("networkidle");
  expect(errors).toEqual([]);
});
