import { expect, test, type Locator } from "./fixtures";

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

test("the sun glow rises as the marquee comes into view, and stays up", async ({ page }) => {
  await page.goto("/");
  const glow = page.locator("[data-sun-glow]");
  /** How far the glow still sits below its resting place, in px. */
  const rise = () =>
    glow.evaluate((element) => {
      const [, y = "0px"] = getComputedStyle(element).translate.split(" ");
      return parseFloat(y);
    });

  // The marquee block just peeking in at the bottom of the screen: the glow is still low.
  await page.evaluate(() => {
    const block = document.querySelector("[data-marquee]");
    if (!block) throw new Error("No marquee");
    scrollTo(0, block.getBoundingClientRect().top + scrollY - innerHeight + 40);
  });
  await expect.poll(rise).toBeGreaterThan(0);

  // At the very bottom of the page the glow is fully up.
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await expect.poll(rise).toBe(0);
});

test("with reduced motion the marquee stays still", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const marquee = page.locator("[data-marquee]");
  await marquee.scrollIntoViewIfNeeded();

  const start = await trackOffset(marquee);
  await page.waitForTimeout(500);
  expect(await trackOffset(marquee)).toBe(start);
});
