import { availabilityOf } from "../src/features/houses/catalog";
import { catalogData } from "../src/features/houses/data";

/** The house types as the catalog serves them, read synchronously to declare tests per house. */
export const houseTypes = catalogData.houseTypes.map((houseType) => ({
  ...houseType,
  availability: availabilityOf(
    catalogData.units.filter((unit) => unit.houseType === houseType.slug),
  ),
}));
