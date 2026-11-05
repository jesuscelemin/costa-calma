// The sheet's poster comes in a version for each theme and for a screen held across or upright.

export const posterVersions = [
  "dia-horizontal",
  "dia-vertical",
  "noche-horizontal",
  "noche-vertical",
] as const;
export type PosterVersion = (typeof posterVersions)[number];

export const isPosterVersion = (value: string): value is PosterVersion =>
  (posterVersions as readonly string[]).includes(value);

/**
 * How far past the camera's frame each poster goes, as a share of the frame, on every side: an
 * <img> shows nothing past its box, so it reaches as far past the area it is framed in.
 */
export const POSTER_MARGIN = 0.5;

/** Where a house's poster is served. */
export const posterSrc = (slug: string, version: PosterVersion) => `/casas/${slug}/hoja/${version}`;
