import { describe, expect, test } from "vitest";

import { furnitureManifestSchema } from "./furniture-manifest";

// Two pieces, as the furniture script writes them.
const armchair = {
  id: "armchair",
  file: "/media/furniture/armchair.glb",
  size: { w: 0.82, h: 1.02, d: 0.99 },
  materials: ["oak", "fabric"],
  triangles: 2980,
  bytes: 41_000,
};
const plant = { ...armchair, id: "plant", file: "/media/furniture/plant.glb", round: true };

describe("furnitureManifestSchema", () => {
  test("accepts pieces served from public/media/furniture, in the house's materials", () => {
    expect(furnitureManifestSchema.safeParse({ pieces: [armchair, plant] }).success).toBe(true);
  });

  test("rejects a piece named twice", () => {
    const result = furnitureManifestSchema.safeParse({ pieces: [armchair, armchair] });
    expect(result.success).toBe(false);
  });

  test("rejects a piece served from anywhere but its own file", () => {
    const result = furnitureManifestSchema.safeParse({
      pieces: [{ ...armchair, file: "https://dl.polyhaven.org/armchair.glb" }],
    });
    expect(result.success).toBe(false);
  });

  test("rejects a material the house does not have", () => {
    const result = furnitureManifestSchema.safeParse({
      pieces: [{ ...armchair, materials: ["leather"] }],
    });
    expect(result.success).toBe(false);
  });
});
