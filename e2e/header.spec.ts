import { expect, test, type Page } from "@playwright/test";

test.beforeEach(({}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop",
    "Desktop header; the mobile header and menu are covered in mobile-menu.spec.ts",
  );
});

const links = [
  { name: "Casas", section: "tipologias", heading: "Tipologías" },
  { name: "Ubicación", section: "ubicacion", heading: "Ubicación" },
  { name: "Calidades", section: "calidades", heading: "Calidades" },
  { name: "Mapa", section: "mapa", heading: "Mapa" },
];

/** True when nothing (such as the header) is painted over the element's top-left corner. */
async function isUncovered(page: Page, selector: string) {
  return page.locator(selector).evaluate((element) => {
    const { left, top } = element.getBoundingClientRect();
    const hit = document.elementFromPoint(left + 4, top + 4);
    return hit !== null && element.contains(hit);
  });
}

for (const { name, section, heading } of links) {
  test(`header link "${name}" scrolls to its section without covering the title`, async ({
    page,
  }) => {
    await page.goto("/");
    const navigation = page.getByRole("banner").getByRole("navigation", { name: "Principal" });

    await navigation.getByRole("link", { name }).click();

    await expect(page).toHaveURL(new RegExp(`#${section}$`));
    const title = page.locator(`#${section}`).getByRole("heading", { name: heading });
    await expect(title).toBeInViewport();
    await expect.poll(() => isUncovered(page, `#${section}-title`)).toBe(true);
  });
}

test('"Pedir visita" is the single primary action and goes to the Visita section', async ({
  page,
}) => {
  await page.goto("/");
  const cta = page.getByRole("banner").getByRole("link", { name: "Pedir visita" });
  await expect(page.locator('[data-slot="button"][data-variant="default"]')).toHaveCount(1);

  await cta.click();

  await expect(page).toHaveURL(/#visita$/);
  await expect(page.locator("#visita").getByRole("heading", { name: "Visita" })).toBeInViewport();
  await expect.poll(() => isUncovered(page, "#visita-title")).toBe(true);
});

test("header logo links to the landing", async ({ page }) => {
  await page.goto("/#mapa");

  const home = page.getByRole("banner").getByRole("link", { name: "Costa Calma" });
  await expect(home).toHaveAttribute("href", "/");
});

test("header hides when scrolling down and comes back when scrolling up", async ({ page }) => {
  await page.goto("/");
  const header = page.getByRole("banner");
  await expect(header).toBeInViewport();

  await page.mouse.move(720, 450);
  await page.mouse.wheel(0, 1600);
  await expect(header).not.toBeInViewport();

  await page.mouse.wheel(0, -300);
  await expect(header).toBeInViewport();
});

test("header still hides on scroll after clicking one of its links", async ({ page }) => {
  await page.goto("/");
  const header = page.getByRole("banner");

  await header.getByRole("link", { name: "Casas" }).click();
  await expect(page).toHaveURL(/#tipologias$/);
  await page.mouse.move(720, 450);
  await page.mouse.wheel(0, 1200);

  await expect(header).not.toBeInViewport();
});

test("first Tab focuses the skip link, which jumps to the main content", async ({ page }) => {
  await page.goto("/");

  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Saltar al contenido" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();

  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#contenido$/);
});

test("scrolling back up to a section keeps its title clear of the visible header", async ({
  page,
}) => {
  await page.goto("/#visita");
  const header = page.getByRole("banner");

  await header
    .getByRole("navigation", { name: "Principal" })
    .getByRole("link", { name: "Casas" })
    .click();

  await expect(header).toBeInViewport();
  await expect(page.locator("#tipologias-title")).toBeInViewport();
  await expect.poll(() => isUncovered(page, "#tipologias-title")).toBe(true);
  // The section itself starts below the visible header (scroll-margin).
  await expect
    .poll(async () => {
      const headerBox = await header.boundingBox();
      const sectionBox = await page.locator("#tipologias").boundingBox();
      return (sectionBox?.y ?? 0) - ((headerBox?.y ?? 0) + (headerBox?.height ?? 0));
    })
    .toBeGreaterThanOrEqual(-1);
});

test("with reduced motion the header changes state without animating", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  const animates = await page.getByRole("banner").evaluate((element) => {
    const style = getComputedStyle(element);
    const durations = style.transitionDuration.split(",").map((value) => parseFloat(value));
    return style.transitionProperty !== "none" && durations.some((value) => value > 0);
  });
  expect(animates).toBe(false);

  const header = page.getByRole("banner");
  await page.mouse.move(720, 450);
  await page.mouse.wheel(0, 1600);
  await expect(header).not.toBeInViewport();
  await page.mouse.wheel(0, -300);
  await expect(header).toBeInViewport();
});
