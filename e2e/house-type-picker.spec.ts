import { expect, test, type Locator, type Page } from "./fixtures";

import { keyFiguresLabel, offerLabel } from "../src/features/houses/catalog";

import { waitForImage } from "./hero";
import { centreCard, houseTypeCards, houseTypes } from "./houses";

const picker = (page: Page) => page.locator("#tipologias");
const cards = houseTypeCards;

/** How much light a card's image has: its CSS brightness, 1 when untouched. */
function brightness(card: Locator) {
  return card.locator("[data-card-image]").evaluate((image) => {
    const match = /brightness\(([\d.]+)\)/.exec(getComputedStyle(image).filter);
    return match ? Number(match[1]) : 1;
  });
}

const width = async (card: Locator) => (await card.boundingBox())?.width ?? 0;

/** Brightness and width of every card, once their transitions have settled. */
async function settledCards(page: Page) {
  // getAnimations() flushes styles first, so a transition about to start counts as running.
  await expect
    .poll(() => picker(page).evaluate((section) => section.getAnimations({ subtree: true }).length))
    .toBe(0);
  return Promise.all(
    (await cards(page).all()).map(async (card) => ({
      light: await brightness(card),
      width: await width(card),
    })),
  );
}

/** The pointed card is brighter and wider than the rest, which are dimmed and equal. */
function expectLit(
  states: { light: number; width: number }[],
  index: number,
  { widens }: { widens: boolean },
) {
  const pointed = states[index];
  const others = states.filter((_, i) => i !== index);
  for (const other of others) {
    expect(pointed.light).toBeGreaterThan(1);
    expect(other.light).toBeLessThan(1);
    if (widens) expect(pointed.width).toBeGreaterThan(other.width * 1.4);
    else expect(Math.abs(pointed.width - other.width)).toBeLessThan(1);
  }
}

test("follows the flight as a list with a link to each house type", async ({ page }) => {
  await page.goto("/");

  const ids = await page
    .locator("main > section[id]")
    .evaluateAll((sections) => sections.map((section) => section.id));
  expect(ids.indexOf("tipologias")).toBe(ids.indexOf("vuelo") + 1);
  await expect(picker(page).getByRole("heading", { level: 2 })).toHaveAccessibleName(
    "Elige tu casa",
  );

  const links = picker(page).getByRole("list").getByRole("link");
  await expect(links).toHaveCount(houseTypes.length);
  for (const [index, { slug, name, kind, figures, availability }] of houseTypes.entries()) {
    const link = links.nth(index);
    await expect(link).toHaveAccessibleName(name);
    await expect(link).toHaveAttribute("href", `/casas/${slug}`);
    // Its figures and offer reach screen readers as its description.
    await expect(link).toHaveAccessibleDescription(
      new RegExp(`^${kind} ${keyFiguresLabel(figures)} ${offerLabel(availability)}`),
    );
  }
});

test("each card shows its price from or «Agotada», and «Tour próximamente» while it has no tour", async ({
  page,
}) => {
  await page.goto("/");

  for (const { name, hasTour, availability } of houseTypes) {
    const card = cards(page).filter({ has: page.getByRole("link", { name }) });
    await card.scrollIntoViewIfNeeded();
    await waitForImage(card.locator("img"));
    await expect(card.getByText(offerLabel(availability), { exact: true })).toBeVisible();
    await expect(card.getByText("Tour próximamente")).toHaveCount(hasTour ? 0 : 1);
  }
  // Casa Duna has no unit left in the catalog's data.
  expect(houseTypes.some(({ availability }) => availability.soldOut)).toBe(true);
  await expect(picker(page).getByText("Agotada", { exact: true })).toHaveCount(
    houseTypes.filter(({ availability }) => availability.soldOut).length,
  );
});

test("choosing a card opens its house", async ({ page }) => {
  await page.goto("/#tipologias");
  const { slug, name, title } = houseTypes[1];

  await picker(page).getByRole("link", { name }).click();

  await expect(page).toHaveURL(new RegExp(`/casas/${slug}$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveAccessibleName(
    `${title.lead} ${title.accent}`,
  );
});

test.describe("on desktop", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Panels in a row only on large screens");
  });

  test("the panel under the pointer widens and gains light while the others dim", async ({
    page,
  }) => {
    await page.goto("/#tipologias");

    const rest = await settledCards(page);
    expect(rest.every(({ light }) => light === 1)).toBe(true);
    expect(
      Math.max(...rest.map(({ width }) => width)) - Math.min(...rest.map(({ width }) => width)),
    ).toBeLessThan(1);

    for (const index of [0, 2]) {
      await cards(page).nth(index).hover();
      expectLit(await settledCards(page), index, { widens: true });
    }
  });

  test("keyboard focus does the same as the pointer", async ({ page }) => {
    await page.goto("/#tipologias");
    await page.mouse.move(0, 0);

    await picker(page).getByRole("link", { name: houseTypes[0].name }).focus();
    await page.keyboard.press("Tab");

    await expect(picker(page).getByRole("link", { name: houseTypes[1].name })).toBeFocused();
    expectLit(await settledCards(page), 1, { widens: true });
  });

  test("the panels move with the brand's curve within 400–700 ms", async ({ page }) => {
    await page.goto("/#tipologias");

    const { property, duration, easing } = await cards(page)
      .first()
      .evaluate((item) => {
        const style = getComputedStyle(item);
        return {
          property: style.transitionProperty,
          duration: parseFloat(style.transitionDuration) * 1000,
          easing: style.transitionTimingFunction,
        };
      });
    expect(property).toBe("flex-grow");
    expect(duration).toBeGreaterThanOrEqual(400);
    expect(duration).toBeLessThanOrEqual(700);
    expect(easing).toBe("cubic-bezier(0.22, 1, 0.36, 1)");
  });

  test("with reduced motion the panels keep their width and only the light changes", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/#tipologias");

    await cards(page).nth(1).hover();
    expectLit(await settledCards(page), 1, { widens: false });
  });
});

test.describe("on phones", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "The carousel is only on small screens");
  });

  test("is a scroll-snap carousel whose centred card is lit, with its dot", async ({ page }) => {
    await page.goto("/#tipologias");
    const list = picker(page).getByRole("list");
    await expect(list).toHaveCSS("scroll-snap-type", "x mandatory");
    const dots = picker(page).locator("[data-dot]");
    await expect(dots).toHaveCount(houseTypes.length);

    for (const index of [0, 1, 2, 1]) {
      await centreCard(page, index);
      await expect(cards(page).nth(index)).toHaveAttribute("data-centred");
      await expect(dots.nth(index)).toHaveAttribute("data-active");
      await expect(picker(page).locator("[data-centred]")).toHaveCount(1);

      // Centred in the 390 px screen, its neighbours peeking in at the sides.
      const box = await cards(page).nth(index).boundingBox();
      expect(Math.abs(box!.x + box!.width / 2 - 195)).toBeLessThan(2);
      expectLit(await settledCards(page), index, { widens: false });
    }
  });

  test("the carousel stays inside the page, with no sideways overflow", async ({ page }) => {
    await page.goto("/#tipologias");
    await centreCard(page, 2);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
  });
});
