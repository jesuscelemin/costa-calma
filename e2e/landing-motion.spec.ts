import { expect, test, type Page } from "./fixtures";

import { showChapter } from "./flight";

const phrase = "Doce casas blancas entre el pinar y el mar";

/** How tinted each word of the landing's phrase is, 0 (ink-muted) to 1 (ink). */
function tints(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("[data-tint-word]")].map((word) =>
      Number(getComputedStyle(word).getPropertyValue("--tint") || 1),
    ),
  );
}

/**
 * The clip of each house type card's image mask that lies across the screen's width, in order:
 * on phones the carousel's other cards wait off to the side until they are swiped in.
 */
function cardClips(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("#tipologias [data-image-reveal]")]
      .filter((frame) => {
        const { left, right } = frame.getBoundingClientRect();
        return left < window.innerWidth && right > 0;
      })
      .map((frame) => getComputedStyle(frame.querySelector("[data-image-reveal-mask]")!).clipPath),
  );
}

test("the phrase is read whole and once", async ({ page }) => {
  await page.goto("/");
  const snapshot = await page.getByRole("main").ariaSnapshot();
  expect(snapshot.split(phrase)).toHaveLength(2);
});

test("the phrase tints word by word as it scrolls up the screen", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const words = page.locator("[data-tint-word]");
  // Its top just inside the bottom of the screen: barely started.
  await words.first().evaluate((word) => {
    const top = word.getBoundingClientRect().top + window.scrollY;
    window.scrollTo(0, top - window.innerHeight * 0.88);
  });
  await expect.poll(async () => (await tints(page)).at(-1)).toBe(0);

  await words.last().evaluate((word) => word.scrollIntoView({ block: "start" }));
  await expect.poll(async () => (await tints(page)).every((tint) => tint === 1)).toBe(true);
});

test("the house type images open as they scroll into view", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await expect
    .poll(async () => (await cardClips(page)).every((clip) => clip !== "none"))
    .toBe(true);

  await page.locator("#tipologias").evaluate((element) => element.scrollIntoView());
  await expect
    .poll(async () => (await cardClips(page)).every((clip) => clip === "none"))
    .toBe(true);
});

test("the flight's last chapter offers «Elegir casa», which leads to the house types", async ({
  page,
}) => {
  await page.goto("/");
  await showChapter(page, 2);

  await page.locator("#vuelo").getByRole("link", { name: "Elegir casa" }).click();
  await expect(page).toHaveURL(/#tipologias$/);
});

test.describe("with reduced motion", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  test("the phrase is all ink and the images are never clipped", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    expect((await tints(page)).every((tint) => tint === 1)).toBe(true);
    expect((await cardClips(page)).every((clip) => clip === "none")).toBe(true);
  });
});
