import { expect, test, type Locator, type Page } from "./fixtures";

/** Vertical offset of each line of a title from where it rests, in px (0 once it has entered). */
function lineOffsets(title: Locator) {
  return title.evaluate((element) => {
    return [...element.querySelectorAll<HTMLElement>(".line")].map((line) =>
      Math.round(new DOMMatrixReadOnly(getComputedStyle(line).transform).m42),
    );
  });
}

async function scrollToSection(page: Page, id: string) {
  await page.locator(`#${id}`).evaluate((element) => element.scrollIntoView({ block: "center" }));
}

test.describe("with reduced motion", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  test("scroll is the browser's own, without smoothing", async ({ page }) => {
    await page.goto("/");
    // Give the client a moment to start any smooth scroller it would start.
    await page.waitForLoadState("networkidle");

    const html = page.locator("html");
    await expect(html).not.toHaveClass(/\blenis\b/);
    expect(await html.evaluate((element) => getComputedStyle(element).scrollBehavior)).toBe("auto");
  });

  test("section titles fade in without moving", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await scrollToSection(page, "ubicacion");

    const title = page.locator("#ubicacion").getByRole("heading", { name: "Ubicación" });
    await expect(title).toBeVisible();
    await expect
      .poll(() => title.evaluate((element) => getComputedStyle(element).opacity))
      .toBe("1");
    expect(await title.locator(".line").count()).toBe(0);
  });

  test("header anchors still reach their section", async ({ page, isMobile }) => {
    test.skip(isMobile, "The mobile menu anchors are covered in mobile-menu.spec.ts");
    await page.goto("/");

    await page.getByRole("banner").getByRole("link", { name: "Calidades" }).click();

    await expect(page).toHaveURL(/#calidades$/);
    await expect(
      page.locator("#calidades").getByRole("heading", { name: "Calidades" }),
    ).toBeInViewport();
  });
});

test.describe("with motion", () => {
  test("the landing scrolls smoothly", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("html")).toHaveClass(/\blenis\b/);
  });

  test("section titles rise line by line once, and stay put when scrolled back into view", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const title = page.locator("#ubicacion").getByRole("heading", { name: "Ubicación" });
    // Before it enters the screen, its lines wait below their mask.
    await expect.poll(async () => (await lineOffsets(title)).some((y) => y > 0)).toBe(true);

    await scrollToSection(page, "ubicacion");
    await expect.poll(() => lineOffsets(title)).toEqual([0]);

    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page.locator("#ubicacion")).not.toBeInViewport();
    await scrollToSection(page, "ubicacion");
    expect(await lineOffsets(title)).toEqual([0]);
  });

  test("titles are read whole and once while they animate", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await scrollToSection(page, "calidades");

    // Right away, mid-animation.
    await expect(
      page.locator("#calidades").getByRole("heading", { name: "Calidades", exact: true }),
    ).toHaveCount(1);
    const accessibleText = await page
      .getByRole("contentinfo")
      .locator("[data-reveal]")
      .ariaSnapshot();
    expect(accessibleText.match(/sin prisa/g)).toHaveLength(1);
  });
});
