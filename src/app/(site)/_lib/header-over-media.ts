// While the header lies on the hero or the flight (HeaderShell's `data-over-media`), its controls
// lose their surfaces and turn to the media's light text over the header's own top scrim, as in
// the Galería blanca references (ADR 0014). Shared by everything the header holds.

/** Links and the logo: the media's light text. */
export const overMediaText = "group-data-over-media/header:text-on-media";

/** Secondary and icon buttons: a hairline pill of light text, no surface. */
export const overMediaQuiet =
  "group-data-over-media/header:border-on-media/50 group-data-over-media/header:bg-transparent group-data-over-media/header:text-on-media group-data-over-media/header:hover:bg-on-media/15";

/** The primary button: the light pill with graphite text, in both themes. */
export const overMediaPrimary =
  "group-data-over-media/header:bg-on-media group-data-over-media/header:text-[#141516]";
