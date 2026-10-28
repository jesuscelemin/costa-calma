import { expect, test, type Page } from "@playwright/test";

const footerStops = [
  "Casas",
  "Ubicación",
  "Calidades",
  "Mapa",
  "Visita",
  "GitHub de Jesús Celemín",
  "Código del proyecto",
];

const tabOrder = {
  desktop: [
    "Saltar al contenido",
    "Costa Calma",
    "Casas",
    "Ubicación",
    "Calidades",
    "Mapa",
    /^Cambiar a modo /,
    "Pedir visita",
    ...footerStops,
  ],
  mobile: ["Saltar al contenido", "Costa Calma", "Pedir visita", "Abrir menú", ...footerStops],
};

/** Checks the focused element shows a focus indicator and is not off screen or under the header. */
async function expectVisibleFocus(page: Page, name: string | RegExp) {
  const focused = page.locator(":focus");
  await expect(focused).toHaveAccessibleName(name);
  const { indicator, onScreen } = await focused.evaluate((element) => {
    const style = getComputedStyle(element);
    // focus-ring draws an outline; Button draws a ring as a box-shadow. Tailwind always sets
    // transparent placeholder shadows, so only a non-transparent one counts.
    const shadows = style.boxShadow.split(/,(?![^(]*\))/);
    const ring = shadows.some((s) => s.trim() !== "none" && !s.includes("rgba(0, 0, 0, 0)"));
    const outline = style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0;
    const { top, bottom, left, right } = element.getBoundingClientRect();
    return {
      indicator: ring || outline,
      // 1px of slack: the browser scrolls a focused element just into view, with subpixel rounding.
      onScreen: top >= -1 && left >= -1 && bottom <= innerHeight + 1 && right <= innerWidth + 1,
    };
  });
  expect(indicator, `${String(name)} shows a focus indicator`).toBe(true);
  expect(onScreen, `${String(name)} is on screen when focused`).toBe(true);
}

test.beforeEach(async ({ page }) => {
  // Without smooth scrolling and header animation the checks don't race the motion.
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("Tab reaches every control in a logical order with a visible focus indicator", async ({
  page,
  isMobile,
}) => {
  await page.goto("/");

  for (const name of isMobile ? tabOrder.mobile : tabOrder.desktop) {
    await page.keyboard.press("Tab");
    await expectVisibleFocus(page, name);
  }
});

test("on the 404, Tab goes from the header to the way back home and on to the footer", async ({
  page,
  isMobile,
}) => {
  await page.goto("/esta-pagina-no-existe");
  const [skipLink, ...header] = isMobile
    ? tabOrder.mobile.slice(0, 4)
    : tabOrder.desktop.slice(0, 8);

  // Start on the skip link: in development Next re-renders the not-found tree after load and the
  // browser's first Tab starts from the discarded shell. `next start` reaches the skip link first
  // (checked for #8), as the landing test above asserts.
  await page.getByRole("link", { name: skipLink }).focus();
  for (const name of [...header, "Volver a la portada", ...footerStops]) {
    await page.keyboard.press("Tab");
    await expectVisibleFocus(page, name);
  }
});

test("Shift+Tab from the footer brings the hidden header back into view", async ({
  page,
  isMobile,
}) => {
  await page.goto("/");

  await page.getByRole("contentinfo").getByRole("link", { name: "Casas" }).focus();
  await page.keyboard.press("Shift+Tab");

  await expectVisibleFocus(page, isMobile ? "Abrir menú" : "Pedir visita");
});

test("the mobile menu opened from the keyboard keeps Tab inside it with visible focus", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "The menu only exists on small screens");
  await page.goto("/");
  await page.getByRole("banner").getByRole("button", { name: "Abrir menú" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();

  // Radix skips links when placing the initial focus, so it starts on the close button and the
  // logo link comes last before Tab wraps around inside the dialog.
  const cycle = [
    "Cerrar menú",
    "Casas",
    "Ubicación",
    "Calidades",
    "Mapa",
    /^Cambiar a modo /,
    "Costa Calma",
    "Cerrar menú",
  ];
  for (const [index, name] of cycle.entries()) {
    if (index > 0) await page.keyboard.press("Tab");
    await expectVisibleFocus(page, name);
  }
});
