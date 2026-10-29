import { fileURLToPath } from "node:url";

import sharp from "sharp";
import { expect, test } from "vitest";

import { catalogData } from "./data";
import { floorPoster, type HouseImage, houseImageSizes, houseTypeImages } from "./media";

// Public URLs map to files under public/.
const publicFile = (url: string) =>
  fileURLToPath(new URL(`../../../public${url}`, import.meta.url));

// Placeholders or Google Flow images alike, every one must exist at its final size.
const images: [string, HouseImage][] = catalogData.houseTypes.flatMap(({ slug, floors }) => {
  const { card, hero } = houseTypeImages(slug);
  return [
    [card.portrait, "cardPortrait"],
    [card.landscape, "cardLandscape"],
    [hero.desktop, "heroDesktop"],
    [hero.mobile, "heroMobile"],
    ...floors.flatMap(({ id }): [string, HouseImage][] => {
      const poster = floorPoster(slug, id);
      return [
        [poster.desktop, "floorDesktop"],
        [poster.mobile, "floorMobile"],
      ];
    }),
  ];
});

test.each(images)("%s exists at its final size", async (url, size) => {
  const { width, height } = await sharp(publicFile(url)).metadata();
  expect({ width, height }).toEqual(houseImageSizes[size]);
});
