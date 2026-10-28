import { expect, test, type Locator, type Page } from "@playwright/test";

// `npm run screenshots` sets this to save each view under docs/screenshots for the README.
const capture = process.env.CAPTURE_SCREENSHOTS === "1";

const devThemeScriptWarning = "Encountered a script tag while rendering React component.";

type View = {
  name: string;
  url: string;
  mobileOnly?: boolean;
  /** Puts the page in the state to review once it has loaded. */
  prepare?: (page: Page) => Promise<void>;
  fullPage?: boolean;
  /** Captures only this element instead of the viewport. */
  element?: (page: Page) => Locator;
  /**
   * The document itself answers 404, which Chrome logs as a failed resource. In development Next
   * also client-renders the not-found tree, and React warns about next-themes' inline theme
   * script; `next start` logs neither warning (checked for #8).
   */
  notFound?: boolean;
};

const views: View[] = [
  { name: "landing", url: "/", fullPage: true },
  {
    name: "menu",
    url: "/",
    mobileOnly: true,
    prepare: async (page) => {
      await page.getByRole("banner").getByRole("button", { name: "Abrir menú" }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
    },
  },
  {
    name: "footer",
    url: "/",
    // Taller than the mobile viewport, so capture it whole.
    element: (page) => page.getByRole("contentinfo"),
    prepare: async (page) => {
      await page.getByRole("contentinfo").scrollIntoViewIfNeeded();
      // Scrolling down hides the header; wait for it so the capture shows the settled state.
      await expect(page.getByRole("banner")).not.toBeInViewport();
    },
  },
  { name: "404", url: "/esta-pagina-no-existe", notFound: true },
];

for (const colorScheme of ["light", "dark"] as const) {
  const theme = colorScheme === "light" ? "dia" : "noche";

  for (const view of views) {
    test(`${view.name} in ${theme}: no console errors, broken images or overflow`, async ({
      page,
      isMobile,
    }, testInfo) => {
      test.skip(view.mobileOnly === true && !isMobile, "Only exists on small screens");
      const errors: string[] = [];
      page.on("console", (message) => {
        if (message.type() !== "error") return;
        const source = new URL(message.location().url, page.url()).pathname;
        if (view.notFound === true && source === view.url) return;
        if (view.notFound === true && message.text().startsWith(devThemeScriptWarning)) return;
        errors.push(message.text());
      });
      page.on("pageerror", (error) => errors.push(error.message));

      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
      await page.goto(view.url, { waitUntil: "networkidle" });
      await view.prepare?.(page);

      const broken = await page.evaluate(() =>
        [...document.images]
          .filter((image) => image.complete && image.naturalWidth === 0)
          .map((image) => image.currentSrc || image.src),
      );
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );

      expect(errors).toEqual([]);
      expect(broken).toEqual([]);
      expect(overflow).toBe(0);

      if (capture) {
        const options = {
          path: `docs/screenshots/phase-1/${view.name}-${testInfo.project.name}-${theme}.png`,
          // Next's dev tools badge is not part of the site.
          style: "nextjs-portal { display: none !important; }",
        };
        if (view.element) await view.element(page).screenshot(options);
        else await page.screenshot({ ...options, fullPage: view.fullPage === true });
      }
    });
  }
}
