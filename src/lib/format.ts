// Figures in Spain's format: "685.000 €", "180 m²". The unit follows a no-break space so it never
// wraps away from its number.

const NBSP = " ";

// es-ES leaves four-digit numbers ungrouped by default ("9500"): always group, as prices do.
const number = new Intl.NumberFormat("es-ES", { useGrouping: "always", maximumFractionDigits: 1 });

/** A plain number: "3,5", "1.200". */
export function formatNumber(value: number) {
  return number.format(value);
}

/** A length in metres: "3,5 m". */
export function formatLength(metres: number) {
  return `${number.format(metres)}${NBSP}m`;
}

/** A price in euros, without cents: "685.000 €". */
export function formatPrice(euros: number) {
  return `${number.format(Math.round(euros))}${NBSP}€`;
}

/** A surface in square metres: "180 m²", "31,5 m²". */
export function formatArea(squareMetres: number) {
  return `${number.format(squareMetres)}${NBSP}m²`;
}

const level = new Intl.NumberFormat("es-ES", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  signDisplay: "always",
});

/** A level on a section, in metres above the ground floor, as an architect marks it: "+3,20". */
export function formatLevel(metres: number) {
  // −0 is still +0,00.
  return level.format(metres === 0 ? 0 : metres);
}
