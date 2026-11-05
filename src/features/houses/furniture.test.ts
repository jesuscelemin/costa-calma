import { afterEach, describe, expect, test, vi } from "vitest";

import { furnitureUrl } from "./furniture";

describe("furnitureUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("locally, a piece is served from public/media/furniture", () => {
    vi.stubEnv("NEXT_PUBLIC_FURNITURE_URL", "");
    expect(furnitureUrl("/media/furniture/sofa.glb")).toBe("/media/furniture/sofa.glb");
  });

  test("deployed, from the storage NEXT_PUBLIC_FURNITURE_URL names, with or without its slash", () => {
    for (const base of ["https://store.example/furniture", "https://store.example/furniture/"]) {
      vi.stubEnv("NEXT_PUBLIC_FURNITURE_URL", base);
      expect(furnitureUrl("/media/furniture/sofa.mobile.glb")).toBe(
        "https://store.example/furniture/sofa.mobile.glb",
      );
    }
  });
});
