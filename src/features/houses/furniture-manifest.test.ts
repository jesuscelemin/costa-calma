import { describe, expect, test } from "vitest";

import { furnitureManifestSchema } from "./furniture-manifest";

// Two pieces, as the furniture script writes them.
const armchair = {
  id: "armchair",
  size: { w: 0.82, h: 1.02, d: 0.99 },
  triangles: 2980,
  desktop: { file: "/media/furniture/armchair.glb", bytes: 410_000 },
  mobile: { file: "/media/furniture/armchair.mobile.glb", bytes: 160_000 },
};
const plant = {
  ...armchair,
  id: "plant",
  desktop: { file: "/media/furniture/plant.glb", bytes: 300_000 },
  mobile: { file: "/media/furniture/plant.mobile.glb", bytes: 120_000 },
  round: true,
};

describe("furnitureManifestSchema", () => {
  test("accepts pieces served from public/media/furniture, each in a desktop and a mobile file", () => {
    expect(furnitureManifestSchema.safeParse({ pieces: [armchair, plant] }).success).toBe(true);
  });

  test("rejects a piece named twice", () => {
    const result = furnitureManifestSchema.safeParse({ pieces: [armchair, armchair] });
    expect(result.success).toBe(false);
  });

  test("rejects a piece served from anywhere but its own file", () => {
    const result = furnitureManifestSchema.safeParse({
      pieces: [
        {
          ...armchair,
          desktop: { file: "https://dl.polyhaven.org/armchair.glb", bytes: 410_000 },
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  test("rejects a mobile version that is another piece's file", () => {
    const result = furnitureManifestSchema.safeParse({
      pieces: [{ ...armchair, mobile: { file: "/media/furniture/plant.mobile.glb", bytes: 1 } }],
    });
    expect(result.success).toBe(false);
  });
});
