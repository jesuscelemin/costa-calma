import { describe, expect, test } from "vitest";

import { catalogData } from "./data";
import { catalogDataSchema } from "./schema";

const [villaMar] = catalogData.houseTypes;
const unit = { number: 1, houseType: "villa-mar", price: 685000, status: "available" };

function issues(data: unknown) {
  const result = catalogDataSchema.safeParse(data);
  return result.success ? [] : result.error.issues.map(({ message }) => message);
}

describe("catalogDataSchema", () => {
  test("accepts the development's data", () => {
    expect(issues(catalogData)).toEqual([]);
  });

  test("rejects a unit of a house type that does not exist", () => {
    expect(
      issues({ houseTypes: [villaMar], units: [{ ...unit, houseType: "casa-faro" }] }),
    ).toEqual(['Unit 1 has an unknown house type "casa-faro"']);
  });

  test("rejects two units with the same number", () => {
    expect(issues({ houseTypes: [villaMar], units: [unit, { ...unit, price: 695000 }] })).toEqual([
      "Unit number 1 is repeated",
    ]);
  });

  test("rejects a repeated slug and a repeated floor", () => {
    const floors = [...villaMar.floors, villaMar.floors[0]];
    expect(issues({ houseTypes: [villaMar, { ...villaMar, floors }], units: [] })).toEqual([
      'House type "villa-mar" is repeated',
      'Floor "plot" of "villa-mar" is repeated',
    ]);
  });

  test("slugs are Spanish words in kebab-case, as they appear in the URL", () => {
    expect(issues({ houseTypes: [{ ...villaMar, slug: "Villa_Mar" }], units: [] })).toEqual([
      "Spanish words in kebab-case",
    ]);
  });
});
