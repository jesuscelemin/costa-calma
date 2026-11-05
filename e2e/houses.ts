import { expect, type Page } from "./fixtures";

import { availabilityOf } from "../src/features/houses/catalog";
import { catalogData } from "../src/features/houses/data";

/** The house types as the catalog serves them, read synchronously to declare tests per house. */
export const houseTypes = catalogData.houseTypes.map((houseType) => ({
  ...houseType,
  availability: availabilityOf(
    catalogData.units.filter((unit) => unit.houseType === houseType.slug),
  ),
}));

/** The house type cards of the landing's selection, in order. */
export const houseTypeCards = (page: Page) => page.locator("#tipologias [data-picker-item]");

/** Swipes the landing's carousel so the card at `index` snaps to the centre (phones). */
export async function centreCard(page: Page, index: number) {
  await houseTypeCards(page)
    .nth(index)
    .evaluate((card) => card.scrollIntoView({ inline: "center", block: "nearest" }));
  await expect(houseTypeCards(page).nth(index)).toHaveAttribute("data-centred");
}

/** Lights the card at `index`: under the pointer on desktop, centred in the carousel on phones. */
export async function pointAtCard(page: Page, index: number) {
  // Below Tailwind's md, 48rem, the cards are a carousel (MOBILE_QUERY).
  if ((page.viewportSize()?.width ?? 0) < 768) await centreCard(page, index);
  else await houseTypeCards(page).nth(index).hover();
}
