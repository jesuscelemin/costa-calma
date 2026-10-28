import { expect, test } from "@playwright/test";

test("landing shows the Costa Calma logo with its accessible name", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("img", { name: "Costa Calma" }).first()).toBeVisible();
});

test("landing declares the brand favicon and a working Open Graph image", async ({
  page,
  request,
}) => {
  await page.goto("/");

  const icon = page.locator('head link[rel="icon"][type="image/svg+xml"]');
  await expect(icon).toHaveCount(1);
  const iconResponse = await request.get((await icon.getAttribute("href")) ?? "");
  expect(iconResponse.ok()).toBe(true);

  await expect(page.locator('head meta[property="og:title"]')).toHaveAttribute(
    "content",
    /Costa Calma/,
  );
  await expect(page.locator('head meta[property="og:locale"]')).toHaveAttribute("content", "es_ES");
  await expect(page.locator('head meta[property="og:image:alt"]')).toHaveAttribute(
    "content",
    /Costa Calma/,
  );
  const ogImage = new URL(
    (await page.locator('head meta[property="og:image"]').getAttribute("content")) ?? "",
  );
  const imageResponse = await request.get(ogImage.pathname + ogImage.search);
  expect(imageResponse.ok()).toBe(true);
  expect(imageResponse.headers()["content-type"]).toBe("image/png");

  const appleIcon = page.locator('head link[rel="apple-touch-icon"]');
  await expect(appleIcon).toHaveCount(1);
  expect((await request.get((await appleIcon.getAttribute("href")) ?? "")).ok()).toBe(true);
});

test("buttons show a pointer cursor like links do", async ({ page, isMobile }) => {
  await page.goto("/");
  const button = page
    .getByRole("banner")
    .getByRole("button", { name: isMobile ? "Abrir menú" : /^Cambiar a modo / });

  expect(await button.evaluate((element) => getComputedStyle(element).cursor)).toBe("pointer");
});
