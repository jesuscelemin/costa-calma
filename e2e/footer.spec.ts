import { expect, test, type Locator } from "./fixtures";

/** Horizontal position of the marquee's moving track, in px. */
function trackOffset(marquee: Locator) {
  return marquee.evaluate((element) => {
    const track = element.firstElementChild;
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

test("Pedir visita goes to the visit section, and the large links show focus", async ({ page }) => {
  await page.goto("/");
  const link = page.getByRole("contentinfo").getByRole("link", { name: "Pedir visita" });

  await expect(link).toHaveCSS("font-family", /Darker Grotesque/);
  await expect(link.locator("[data-underline]")).toHaveCSS("text-decoration-line", "underline");
  await link.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(link).toBeFocused();
  await expect(link).not.toHaveCSS("outline-style", "none");

  await link.click();

  await expect(page).toHaveURL(/#visita$/);
  await expect(page.locator("#visita").getByRole("heading", { name: "Visita" })).toBeInViewport();
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

test("the marquee scrolls on its own", async ({ page }) => {
  await page.goto("/");
  const marquee = page.locator("[data-marquee]");
  await marquee.scrollIntoViewIfNeeded();

  const start = await trackOffset(marquee);
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
});
