import { existsSync, statSync } from "node:fs";

import { describe, expect, test } from "vitest";

import manifestJson from "../../../public/media/flight/manifest.json";
import { sequenceManifestSchema } from "@/lib/sequence-manifest";

import { flightManifest } from "./manifest";

// Public URLs in the manifest map to files under public/.
const publicFile = (url: string) => new URL(`../../../public${url}`, import.meta.url);

describe("the flight manifest", () => {
  test("is a valid sequence manifest", () => {
    const result = sequenceManifestSchema.safeParse(manifestJson);
    expect(result.error?.issues).toBeUndefined();
  });

  test("names the three chapters of the flight, in order", () => {
    expect(flightManifest.chapters.map(({ id }) => id)).toEqual(["sea", "beach", "development"]);
  });

  test("names only files that exist", () => {
    const { desktop, mobile } = flightManifest.sources;
    const urls = [
      ...[desktop, mobile].flatMap(({ mp4, webm, poster }) => [mp4, webm, poster]),
      ...flightManifest.chapters.flatMap(({ still }) => [still.desktop, still.mobile]),
    ];
    const missing = urls.filter((url) => !existsSync(publicFile(url)));
    expect(missing).toEqual([]);
  });

  // Spec #10: under 4 MB on desktop and 2.5 MB on mobile, for whichever video the browser picks.
  test.each([
    ["desktop", 4_000_000],
    ["mobile", 2_500_000],
  ] as const)("keeps the %s videos within budget", (format, budget) => {
    const { mp4, webm } = flightManifest.sources[format];
    for (const url of [mp4, webm]) {
      expect(statSync(publicFile(url)).size, url).toBeLessThan(budget);
    }
  });
});
