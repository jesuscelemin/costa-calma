import { describe, expect, test } from "vitest";

import { catalogData } from "@/features/houses/data";

import { modelCopy } from "./model-copy";

const plan = (slug: string) => catalogData.houseTypes.find((type) => type.slug === slug)!.plan;

// Figures with a no-break space before their unit, as formatArea writes them.
const m2 = (n: string) => `${n} m²`;

describe("the figures beside the model", () => {
  test("add up Villa Mar as it is built, from its plot to its open floors", () => {
    const copy = modelCopy(plan("villa-mar"));
    expect(copy.plot).toMatchObject({
      figure: m2("462"),
      text: "de parcela, con una piscina de 9 × 3,5\u00a0m",
    });
    expect(copy.plan).toMatchObject({ figure: m2("120"), text: "en planta baja, en 9 estancias" });
    expect(copy.walls).toMatchObject({
      figure: "8",
      text: "ventanas en planta baja, 2 de ellas correderas",
    });
    expect(copy.storeys).toMatchObject({
      figure: m2("227"),
      text: "construidos en 2 plantas, con una azotea de 156 m²".replace(" m²", " m²"),
    });
    expect(copy.open).toMatchObject({ figure: "4", text: "dormitorios y 3 baños" });
  });

  test("a house without a pool or a roof says only what it has", () => {
    const copy = modelCopy(plan("casa-pinar"));
    expect(copy.plot).toMatchObject({ figure: m2("288"), text: "de parcela" });
    expect(copy.storeys.text).toBe("construidos en 2 plantas");
    expect(copy.open.text).toBe("dormitorios, 2 baños y 1 aseo");
  });
});
