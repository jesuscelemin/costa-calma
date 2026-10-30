import { expect, test, type Page } from "./fixtures";

import {
  chooseCardAt,
  introMarks,
  layoutShift,
  morphGroup,
  openSelectionAt,
  prefetches,
  recordIntro,
  recordLayoutShifts,
  recordViewTransitions,
  transitionsSettled,
  viewTransitions,
} from "./house-transition";
import { houseTypeCards, houseTypes } from "./houses";

const { slug, name } = houseTypes[1];
const housePath = new RegExp(`/casas/${slug}$`);
const backToHouses = (page: Page) => page.getByRole("link", { name: "Volver a las casas" });
const houseHero = (page: Page) => page.getByRole("region", { name, exact: true });
const scrollY = (page: Page) => page.evaluate(() => Math.round(window.scrollY));

const pointAtSecondCard = (page: Page) => openSelectionAt(page, 1);
const chooseCard = (page: Page) => chooseCardAt(page, 1);

/** Chooses the landing's second card. */
async function chooseFromLanding(page: Page) {
  await pointAtSecondCard(page);
  const from = await scrollY(page);
  await recordIntro(page);
  await chooseCard(page);
  await expect(page).toHaveURL(housePath);
  await transitionsSettled(page);
  // Without a prefetch the house arrives after its loading screen, with no transition to wait for.
  await expect(houseHero(page)).toBeInViewport({ ratio: 0.9 });
  return from;
}

test.beforeEach(async ({ page }) => {
  await recordViewTransitions(page);
});

test("choosing a card morphs it into the house's hero, without layout shifts", async ({ page }) => {
  test.skip(!prefetches, "Only a production build prefetches the house, which the morph needs");
  await pointAtSecondCard(page);
  await recordLayoutShifts(page);

  await chooseCard(page);
  await expect(page).toHaveURL(housePath);
  await transitionsSettled(page);

  expect((await viewTransitions(page)).flat()).toContain(morphGroup(slug));
  await expect(houseHero(page)).toBeInViewport({ ratio: 0.9 });
  expect(await layoutShift(page)).toBeLessThan(0.01);
});

test("«Volver a las casas» goes back to the selection with the chosen card in view", async ({
  page,
}) => {
  const from = await chooseFromLanding(page);
  const entries = await page.evaluate(() => history.length);

  await backToHouses(page).click();

  await expect(page).toHaveURL(/\/#tipologias$/);
  // Back through the history, so the browser restored the scroll: no new entry.
  expect(await page.evaluate(() => history.length)).toBe(entries);
  await transitionsSettled(page);
  await expect(houseTypeCards(page).nth(1)).toBeInViewport({ ratio: 0.5 });
  expect(Math.abs((await scrollY(page)) - from)).toBeLessThan(4);
  // A page transition, but no morph: at the end of the page the hero is far out of view.
  const back = (await viewTransitions(page)).at(-1);
  expect(back).toContain("::view-transition-old(root)");
  expect(await introMarks(page)).toEqual([]);
  await expect(page.locator("[data-intro-overlay]")).toBeHidden();
});

test("the browser's back button returns to the selection, morphing the hero back", async ({
  page,
}) => {
  const from = await chooseFromLanding(page);

  await page.goBack();

  await expect(page).toHaveURL(/\/#tipologias$/);
  await transitionsSettled(page);
  await expect(houseTypeCards(page).nth(1)).toBeInViewport({ ratio: 0.5 });
  expect(Math.abs((await scrollY(page)) - from)).toBeLessThan(4);
  const back = (await viewTransitions(page)).at(-1);
  expect(back).toContain(morphGroup(slug));
  expect(await introMarks(page)).toEqual([]);
});

test.describe("from a direct link", () => {
  // The session starts on the house: the landing's intro must not play on the way there.
  test.use({ intro: "unseen" });

  test("«Volver a las casas» lands on the selection, not on the hero, with no intro", async ({
    page,
  }) => {
    await page.goto(`/casas/${slug}`);
    await recordIntro(page);

    await backToHouses(page).click();

    await expect(page).toHaveURL(/\/#tipologias$/);
    await expect(page.locator("#tipologias")).toBeInViewport();
    await expect(page.locator("#hero")).not.toBeInViewport();
    expect(await introMarks(page)).toEqual([]);
    await expect(page.locator("[data-intro-overlay]")).toBeHidden();
  });
});

test("with reduced motion the house fades in instead of morphing", async ({ page }) => {
  test.skip(!prefetches, "Only a production build prefetches the house, which the fade needs");
  await page.emulateMedia({ reducedMotion: "reduce" });

  await chooseFromLanding(page);

  const [forward] = await viewTransitions(page);
  expect(forward).toContain("::view-transition-old(root)");
  expect(forward).not.toContain(morphGroup(slug));
  await expect(houseHero(page)).toBeInViewport({ ratio: 0.9 });
});

test("«Volver a las casas» closes the house page, after its floors", async ({ page }) => {
  await page.goto(`/casas/${slug}`);

  const floors = page.getByRole("region", { name: "Recorre la casa" });
  const link = backToHouses(page);
  await expect(link).toHaveCount(1);
  const [floorsBox, linkBox] = await Promise.all([floors.boundingBox(), link.boundingBox()]);
  expect(linkBox!.y).toBeGreaterThan(floorsBox!.y + floorsBox!.height);
  // Secondary: «Pedir visita» stays the view's single primary button.
  await expect(link).toHaveAttribute("data-variant", "secondary");
});
