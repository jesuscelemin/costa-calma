import { expect, test, type Page } from "@playwright/test";

// Page background (surface token) in each theme.
const surface = { day: "rgb(246, 241, 232)", night: "rgb(18, 27, 28)" };

const pageBackground = (page: Page) =>
  page.locator("html").evaluate((element) => getComputedStyle(element).backgroundColor);

for (const [colorScheme, theme, background] of [
  ["light", "light", surface.day],
  ["dark", "dark", surface.night],
] as const) {
  test(`without a saved choice the theme follows a ${colorScheme} system`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await page.goto("/");

    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await expect.poll(() => pageBackground(page)).toBe(background);
  });
}

/** The theme toggle lives in the desktop header and, on mobile, inside the menu. */
async function openThemeToggle(page: Page, isMobile: boolean) {
  if (isMobile) {
    await page.getByRole("banner").getByRole("button", { name: "Abrir menú" }).click();
    return page.getByRole("dialog");
  }
  return page.getByRole("banner");
}

test("the toggle switches Día/Noche and the choice survives a reload without a flash", async ({
  page,
  isMobile,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");

  const scope = await openThemeToggle(page, isMobile);
  await scope.getByRole("button", { name: "Cambiar a modo Noche" }).click();

  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(scope.getByRole("button", { name: "Cambiar a modo Día" })).toBeVisible();

  // Without the app's JavaScript only the inline theme script can apply the saved choice, which
  // proves it is in place before the first paint.
  await page.route("**/_next/static/**/*.js", (route) => route.abort());
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect.poll(() => pageBackground(page)).toBe(surface.night);
});

test("choosing Día overrides a dark system and persists", async ({ page, isMobile }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");

  const scope = await openThemeToggle(page, isMobile);
  await scope.getByRole("button", { name: "Cambiar a modo Día" }).click();
  await expect.poll(() => pageBackground(page)).toBe(surface.day);

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect.poll(() => pageBackground(page)).toBe(surface.day);
});
