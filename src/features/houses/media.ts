// Images of each house type, in public/media/houses/<slug>/. Placeholders until the Google Flow
// images arrive (npm run media:houses, docs/media/houses.md); the real ones keep these names and
// sizes, so swapping them never touches the code. Self-contained: the script imports it too.

/** Final size of each image, in px. */
export const houseImageSizes = {
  /** Selection of house types: tall panels on desktop, the carousel on phones (3:4). */
  cardPortrait: { width: 1200, height: 1600 },
  /** The card where it lies wide: the map and the admin (16:10). */
  cardLandscape: { width: 1600, height: 1000 },
  /** The house page's full-screen hero (16:9 and 9:16). */
  heroDesktop: { width: 1920, height: 1080 },
  heroMobile: { width: 1080, height: 1920 },
  /** Each floor's poster: the first frame of its tour, the size of the tour's clips. */
  floorDesktop: { width: 1600, height: 900 },
  floorMobile: { width: 720, height: 1280 },
} as const;

export type HouseImage = keyof typeof houseImageSizes;

const base = (slug: string) => `/media/houses/${slug}`;

/** Public paths of a house type's card and hero. */
export function houseTypeImages(slug: string) {
  return {
    card: {
      portrait: `${base(slug)}/card-portrait.webp`,
      landscape: `${base(slug)}/card-landscape.webp`,
    },
    hero: { desktop: `${base(slug)}/hero-desktop.webp`, mobile: `${base(slug)}/hero-mobile.webp` },
  };
}

/** Public paths of a floor's poster. */
export function floorPoster(slug: string, floorId: string) {
  return {
    desktop: `${base(slug)}/floors/${floorId}-desktop.webp`,
    mobile: `${base(slug)}/floors/${floorId}-mobile.webp`,
  };
}

/** The house types with a model so far; Casa Pinar's and Casa Duna's come next (#33). */
const MODELLED = new Set(["villa-mar"]);

/** Whether a house type has its model: its 2D plans are then part of it. */
export function hasModel(slug: string) {
  return MODELLED.has(slug);
}
