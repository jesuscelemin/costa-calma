// Landing sections in order. Their ids are the URL anchors (Spanish, see ADR 0001).
export const landingSections = {
  hero: "hero",
  flight: "vuelo",
  houseTypes: "tipologias",
  location: "ubicacion",
  qualities: "calidades",
  map: "mapa",
  visit: "visita",
} as const;

/** Absolute anchor link, so it also works from other routes such as /casas/[slug]. */
export function sectionHref(id: (typeof landingSections)[keyof typeof landingSections]) {
  return `/#${id}`;
}
