import { describe, expect, test } from "vitest";

import {
  availabilityLabel,
  availabilityOf,
  getHouseType,
  listHouseTypes,
  offerLabel,
} from "./catalog";

describe("availabilityOf", () => {
  test("the price from is the lowest price among the available units only", () => {
    const availability = availabilityOf([
      { price: 640000, status: "sold" },
      { price: 655000, status: "reserved" },
      { price: 720000, status: "available" },
      { price: 690000, status: "available" },
    ]);
    expect(availability).toEqual({ total: 4, available: 2, priceFrom: 690000, soldOut: false });
  });

  test("a house type with no available unit is sold out and has no price from", () => {
    const availability = availabilityOf([
      { price: 380000, status: "sold" },
      { price: 395000, status: "reserved" },
    ]);
    expect(availability).toEqual({ total: 2, available: 0, priceFrom: null, soldOut: true });
  });
});

describe("availabilityLabel", () => {
  test("counts the available units out of the total", () => {
    expect(availabilityLabel({ total: 4, available: 2, priceFrom: 690000, soldOut: false })).toBe(
      "2 de 4 disponibles",
    );
    expect(availabilityLabel({ total: 4, available: 1, priceFrom: 690000, soldOut: false })).toBe(
      "1 de 4 disponible",
    );
  });

  test("says «Agotada» when none is left", () => {
    expect(availabilityLabel({ total: 4, available: 0, priceFrom: null, soldOut: true })).toBe(
      "Agotada",
    );
  });
});

describe("offerLabel", () => {
  test("offers the price from, in Spanish format", () => {
    expect(offerLabel({ total: 4, available: 2, priceFrom: 685000, soldOut: false })).toBe(
      "Desde 685.000\u00a0€",
    );
  });

  test("says «Agotada» instead of a price when none is left", () => {
    expect(offerLabel({ total: 4, available: 0, priceFrom: null, soldOut: true })).toBe("Agotada");
  });
});

describe("catalog", () => {
  test("lists the three house types, Villa Mar first", async () => {
    const houseTypes = await listHouseTypes();
    expect(houseTypes.map(({ slug }) => slug)).toEqual(["villa-mar", "casa-pinar", "casa-duna"]);
  });

  test("the development's 12 units are split 4 per house type", async () => {
    const houseTypes = await listHouseTypes();
    expect(houseTypes.map(({ availability }) => availability.total)).toEqual([4, 4, 4]);
  });

  test("finds a house type by its slug, with its availability", async () => {
    const villaMar = await getHouseType("villa-mar");
    expect(villaMar?.name).toBe("Villa Mar");
    expect(villaMar?.availability.total).toBe(4);
  });

  test("an unknown slug finds nothing", async () => {
    expect(await getHouseType("casa-faro")).toBeUndefined();
  });
});
