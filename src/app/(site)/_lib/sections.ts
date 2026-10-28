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

/** Header navigation, shared by the desktop bar and the mobile menu. */
export const headerNavigation = [
  { label: "Casas", href: sectionHref(landingSections.houseTypes) },
  { label: "Ubicación", href: sectionHref(landingSections.location) },
  { label: "Calidades", href: sectionHref(landingSections.qualities) },
  { label: "Mapa", href: sectionHref(landingSections.map) },
];
