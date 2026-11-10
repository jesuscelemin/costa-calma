import { describe, expect, test } from "vitest";

import { catalogData } from "./data";
import { catalogDataSchema } from "./schema";

const [villaDunaBlanca, casaPinar] = catalogData.houseTypes;
const unit = { number: 1, houseType: "villa-duna-blanca", price: 2450000, status: "available" };

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
      issues({ houseTypes: [villaDunaBlanca], units: [{ ...unit, houseType: "casa-faro" }] }),
    ).toEqual(['Unit 1 has an unknown house type "casa-faro"']);
  });

  test("rejects two units with the same number", () => {
    expect(
      issues({ houseTypes: [villaDunaBlanca], units: [unit, { ...unit, price: 2550000 }] }),
    ).toEqual(["Unit number 1 is repeated"]);
  });

  test("rejects a repeated slug and a repeated floor", () => {
    const floors = [...casaPinar!.floors, casaPinar!.floors[0]];
    expect(issues({ houseTypes: [casaPinar, { ...casaPinar, floors }], units: [] })).toEqual([
      'The floors of "casa-pinar" are not its plan\'s',
      'House type "casa-pinar" is repeated',
      'Floor "plot" of "casa-pinar" is repeated',
    ]);
  });

  test("slugs are Spanish words in kebab-case, as they appear in the URL", () => {
    expect(issues({ houseTypes: [{ ...villaDunaBlanca, slug: "Villa_Duna" }], units: [] })).toEqual(
      ["Spanish words in kebab-case"],
    );
  });
  test("a house type with a plan takes its floors and figures from it, and the plan is coherent", () => {
    const figures = { ...villaDunaBlanca.figures, bedrooms: 5 };
    expect(issues({ houseTypes: [{ ...villaDunaBlanca, figures }], units: [] })).toEqual([
      'The figures of "villa-duna-blanca" are not its plan\'s',
    ]);
    const [plot, ground, ...rest] = villaDunaBlanca.plan.floors;
    const plan = { ...villaDunaBlanca.plan, floors: [plot, { ...ground, openings: [] }, ...rest] };
    expect(issues({ houseTypes: [{ ...villaDunaBlanca, plan }], units: [] })).toContain(
      "Planta baja: it has no front door",
    );
  });
});
