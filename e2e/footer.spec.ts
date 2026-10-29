import { expect, test, type Locator, type Page } from "./fixtures";

/** Horizontal position of the marquee's moving track, in px. */
function trackOffset(marquee: Locator) {
  return marquee.evaluate((element) => {
    const track = element.querySelector("[data-marquee-track]");
    if (!track) throw new Error("The marquee has no track");
    return track.getBoundingClientRect().left;
  });
}

test("the footer says it is a portfolio project and keeps the contact details", async ({
  page,
}) => {
  await page.goto("/");
  const footer = page.getByRole("contentinfo");

  await expect(footer).toContainText(
    "Proyecto de portfolio de Jesús Celemín. Costa Calma es una promotora ficticia.",
  );
  await expect(footer).toContainText("Vivir frente al Mediterráneo, sin prisa.");
  await expect(footer.getByRole("img", { name: "Costa Calma" })).toBeVisible();
  await expect(footer.locator("address")).toContainText("hola@costacalma.example");
  await expect(footer.locator("address")).toContainText("+34 600 000 000");
  await expect(footer.getByRole("link", { name: /LinkedIn/i })).toHaveCount(0);
});

test("the large links go to GitHub and the project's code", async ({ page }) => {
  await page.goto("/");
  const footer = page.getByRole("contentinfo");

  await expect(footer.getByRole("link", { name: "GitHub", exact: true })).toHaveAttribute(
    "href",
    "https://github.com/jesuscelemin",
  );
  await expect(footer.getByRole("link", { name: "Código del proyecto" })).toHaveAttribute(
    "href",
    "https://github.com/jesuscelemin/costa-calma",
  );
});

test("the large links are underlined in Darker Grotesque, with visible focus", async ({ page }) => {
  await page.goto("/");
  const footer = page.getByRole("contentinfo");
  const link = footer.getByRole("link", { name: "GitHub", exact: true });

  await expect(link).toHaveCSS("font-family", /Darker Grotesque/);
  await expect(link).toHaveCSS("text-decoration-line", "underline");
  // Same size as the statement beside them.
  const statementSize = await footer
    .locator("[data-reveal]")
    .evaluate((element) => getComputedStyle(element).fontSize);
  await expect(link).toHaveCSS("font-size", statementSize);

  await footer.getByRole("link", { name: "Mapa" }).focus();
  await page.keyboard.press("Tab");
  await expect(link).toBeFocused();
  await expect(link).not.toHaveCSS("outline-style", "none");
  // Pedir visita already leads the Visita section above.
  await expect(footer.getByRole("link", { name: "Pedir visita" })).toHaveCount(0);
});

test("footer navigation goes to the landing sections", async ({ page }) => {
  await page.goto("/");
  const navigation = page.getByRole("contentinfo").getByRole("navigation");

  await navigation.getByRole("link", { name: "Ubicación" }).click();

  await expect(page).toHaveURL(/#ubicacion$/);
  await expect(
    page.locator("#ubicacion").getByRole("heading", { name: "Ubicación" }),
  ).toBeInViewport();
});

test("the marquee is seen but not read", async ({ page }) => {
  await page.goto("/");
  const marquee = page.locator("[data-marquee]");

  await marquee.scrollIntoViewIfNeeded();
  await expect(marquee).toBeVisible();
  await expect(marquee).toContainText("Costa Calma");
  await expect(marquee).toHaveAttribute("aria-hidden", "true");
  // Not in the accessibility tree at all.
  expect(await marquee.ariaSnapshot()).toBe("");
});

test("the marquee drifts to the right on its own", async ({ page }) => {
  await page.goto("/");
  const marquee = page.locator("[data-marquee]");
  await marquee.scrollIntoViewIfNeeded();

  const start = await trackOffset(marquee);
  await expect.poll(() => trackOffset(marquee)).toBeGreaterThan(start);
});

/** How much of its scroll-driven rise an element still has to go: 1 below, 0 in place. */
function rise(element: Locator) {
  return element.evaluate((node) => {
    const [animation] = node.getAnimations();
    // No animation (reduced motion, no scroll-driven support): simply in place.
    if (!animation) return 0;
    return 1 - (animation.effect?.getComputedTiming().progress ?? 0);
  });
}

/** Scrolls so this share (0–1) of the marquee block has come into view from the bottom. */
async function revealMarqueeBlock(page: Page, share: number) {
  await page.evaluate((share) => {
    const block = document.querySelector("[data-marquee]");
    if (!block) throw new Error("No marquee");
    const { top, height } = block.getBoundingClientRect();
    scrollTo(0, top + scrollY - innerHeight + height * share);
  }, share);
}

test("the marquee rises from below, then the sun glow after it, and both stay up", async ({
  page,
}) => {
  await page.goto("/");
  const name = page.locator("[data-marquee-rise]");
  const glow = page.locator("[data-sun-glow]");

  // Just peeking in: both still below.
  await revealMarqueeBlock(page, 0.1);
  await expect.poll(() => rise(name)).toBeGreaterThan(0);
  await expect.poll(() => rise(glow)).toBeGreaterThan(0);

  // Most of the way in: the name is up, the glow is still rising.
  await revealMarqueeBlock(page, 0.85);
  await expect.poll(() => rise(name)).toBe(0);
  await expect.poll(() => rise(glow)).toBeGreaterThan(0);

  // At the very bottom of the page both are up.
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await expect.poll(() => rise(name)).toBe(0);
  await expect.poll(() => rise(glow)).toBe(0);
});

test("the marquee pauses while the pointer is over it", async ({ page, isMobile }) => {
  test.skip(isMobile, "No hover on touch screens");
  await page.goto("/");
  const marquee = page.locator("[data-marquee]");
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));

  await marquee.hover();
  const start = await trackOffset(marquee);
  await page.waitForTimeout(500);
  expect(await trackOffset(marquee)).toBe(start);

  await page.mouse.move(0, 0);
  await expect.poll(() => trackOffset(marquee)).not.toBe(start);
});

test("with reduced motion the marquee stays still", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const marquee = page.locator("[data-marquee]");
  await marquee.scrollIntoViewIfNeeded();

  const start = await trackOffset(marquee);
  await page.waitForTimeout(500);
  expect(await trackOffset(marquee)).toBe(start);
  // Name and glow are simply in place.
  expect(await rise(page.locator("[data-marquee-rise]"))).toBe(0);
  expect(await rise(page.locator("[data-sun-glow]"))).toBe(0);
});
