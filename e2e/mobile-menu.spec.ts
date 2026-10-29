import { expect, test, type Page } from "./fixtures";

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Mobile header and menu");
});

test("at 390 px the header shows the logo, Pedir visita and the menu button without overflowing", async ({
  page,
}) => {
  await page.goto("/");
  const header = page.getByRole("banner");
  const controls = [
    header.getByRole("link", { name: "Costa Calma" }),
    header.getByRole("link", { name: "Pedir visita" }),
    header.getByRole("button", { name: "Abrir menú" }),
  ];

  const viewport = page.viewportSize();
  for (const control of controls) {
    await expect(control).toBeVisible();
    const box = await control.boundingBox();
    expect(box).not.toBeNull();
    expect((box?.x ?? -1) >= 0 && (box?.x ?? 0) + (box?.width ?? 0) <= (viewport?.width ?? 0)).toBe(
      true,
    );
  }
  await expect(header.getByRole("navigation", { name: "Principal" })).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    viewport?.width ?? 0,
  );
});

test("the menu opens full screen and keeps focus inside it", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("banner").getByRole("button", { name: "Abrir menú" }).click();

  const menu = page.getByRole("dialog", { name: "Menú" });
  await expect(menu).toBeVisible();
  const viewport = page.viewportSize();
  await expect
    .poll(async () => {
      const box = await menu.boundingBox();
      return box && { x: box.x, y: box.y, width: box.width, height: box.height };
    })
    .toEqual({ x: 0, y: 0, width: viewport?.width, height: viewport?.height });
  await expect(menu.getByRole("link", { name: "Ubicación" })).toBeVisible();
  await expect(menu.getByRole("button", { name: /^Cambiar a modo / })).toBeVisible();

  for (let step = 0; step < 12; step++) {
    await page.keyboard.press("Tab");
    expect(await menu.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  }
});

for (const [how, close] of [
  ["Esc", (page) => page.keyboard.press("Escape")],
  ["the close button", (page) => page.getByRole("button", { name: "Cerrar menú" }).click()],
] as const satisfies readonly (readonly [string, (page: Page) => Promise<void>])[]) {
  test(`${how} closes the menu and returns focus to the menu button`, async ({ page }) => {
    await page.goto("/");
    const trigger = page.getByRole("banner").getByRole("button", { name: "Abrir menú" });
    await trigger.click();
    await expect(page.getByRole("dialog", { name: "Menú" })).toBeVisible();

    await close(page);

    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(trigger).toBeFocused();
  });
}

test("choosing a menu link closes the menu and goes to its section", async ({ page }) => {
  await page.goto("/");
  const trigger = page.getByRole("banner").getByRole("button", { name: "Abrir menú" });
  await trigger.click();

  await page.getByRole("dialog").getByRole("link", { name: "Calidades" }).click();

  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page).toHaveURL(/#calidades$/);
  await expect(
    page.locator("#calidades").getByRole("heading", { name: "Calidades" }),
  ).toBeInViewport();
  await expect(trigger).toBeFocused();
});

test("with reduced motion the menu opens and closes without animating", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const animation = () =>
    page.getByRole("dialog").evaluate((element) => getComputedStyle(element).animationName);

  await page.getByRole("banner").getByRole("button", { name: "Abrir menú" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(await animation()).toBe("none");

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
});

test("widening the window to the desktop header closes the menu", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("banner").getByRole("button", { name: "Abrir menú" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();

  await page.setViewportSize({ width: 1024, height: 768 });

  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(
    page.getByRole("banner").getByRole("navigation", { name: "Principal" }),
  ).toBeVisible();
});
