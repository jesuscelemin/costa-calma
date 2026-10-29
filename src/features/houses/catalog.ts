import { formatPrice } from "@/lib/format";

import { catalogData } from "./data";
import type { HouseType, Unit } from "./schema";

// The only way to read the house types and units. Async on purpose: in Phase 5 these become
// Drizzle queries and their callers do not change.

export type Availability = {
  /** Units of the house type in the development. */
  total: number;
  available: number;
  /** Lowest price among the available units, in euros; null when sold out. */
  priceFrom: number | null;
  soldOut: boolean;
};

export type CatalogHouseType = HouseType & { availability: Availability };

/** A house type's availability, from its units. */
export function availabilityOf(units: Pick<Unit, "price" | "status">[]): Availability {
  const prices = units.filter(({ status }) => status === "available").map(({ price }) => price);
  return {
    total: units.length,
    available: prices.length,
    priceFrom: prices.length > 0 ? Math.min(...prices) : null,
    soldOut: prices.length === 0,
  };
}

/** «2 de 4 disponibles», or «Agotada». */
export function availabilityLabel({ total, available, soldOut }: Availability) {
  if (soldOut) return "Agotada";
  return `${available} de ${total} ${available === 1 ? "disponible" : "disponibles"}`;
}

/** «Desde 685.000 €», or «Agotada»: the offer as shared links and metadata state it. */
export function offerLabel(availability: Availability) {
  return availability.priceFrom === null
    ? availabilityLabel(availability)
    : `Desde ${formatPrice(availability.priceFrom)}`;
}

function withAvailability(houseType: HouseType): CatalogHouseType {
  const units = catalogData.units.filter((unit) => unit.houseType === houseType.slug);
  return { ...houseType, availability: availabilityOf(units) };
}

/** Every house type, in the order the development presents them. */
export async function listHouseTypes(): Promise<CatalogHouseType[]> {
  return catalogData.houseTypes.map(withAvailability);
}

/** The house type with this slug, or undefined. */
export async function getHouseType(slug: string): Promise<CatalogHouseType | undefined> {
  const houseType = catalogData.houseTypes.find((candidate) => candidate.slug === slug);
  return houseType && withAvailability(houseType);
}
