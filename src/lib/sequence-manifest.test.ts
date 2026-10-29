import { describe, expect, test } from "vitest";

import { sequenceManifestSchema } from "./sequence-manifest";

const source = (format: string) => ({
  mp4: `/media/flight/${format}/flight.mp4`,
  webm: `/media/flight/${format}/flight.webm`,
  poster: `/media/flight/${format}/poster.webp`,
  width: 1600,
  height: 900,
});

const still = (id: string) => ({
  desktop: `/media/flight/desktop/${id}.webp`,
  mobile: `/media/flight/mobile/${id}.webp`,
});

// A 12 s flight in three chapters of 4 s, as the placeholder script writes it.
const manifest = {
  id: "flight",
  sources: { desktop: source("desktop"), mobile: source("mobile") },
  duration: 12,
  chapters: [
    { id: "sea", start: 0, end: 4, still: still("sea") },
    { id: "beach", start: 4, end: 8, still: still("beach") },
    { id: "development", start: 8, end: 12, still: still("development") },
  ],
};

function withChapters(chapters: typeof manifest.chapters) {
  return { ...manifest, chapters };
}

describe("sequenceManifestSchema", () => {
  test("accepts a flight whose chapters cover the whole clip", () => {
    expect(sequenceManifestSchema.safeParse(manifest).success).toBe(true);
  });

  test("rejects a chapter that ends after the clip", () => {
    const [sea, beach, development] = manifest.chapters;
    const result = sequenceManifestSchema.safeParse(
      withChapters([sea, beach, { ...development, end: 13 }]),
    );
    expect(result.success).toBe(false);
  });

  // Chapters chain like the Flow clips: each one starts where the previous one ends.
  test("rejects a gap between chapters", () => {
    const [sea, beach, development] = manifest.chapters;
    const result = sequenceManifestSchema.safeParse(
      withChapters([sea, { ...beach, start: 5 }, development]),
    );
    expect(result.success).toBe(false);
  });

  test("rejects a flight whose last chapter stops before the clip ends", () => {
    const [sea, beach, development] = manifest.chapters;
    const result = sequenceManifestSchema.safeParse(
      withChapters([sea, beach, { ...development, end: 11 }]),
    );
    expect(result.success).toBe(false);
  });

  // The chapter texts live in a content file keyed by chapter id.
  test("rejects two chapters with the same id", () => {
    const [sea, beach, development] = manifest.chapters;
    const result = sequenceManifestSchema.safeParse(
      withChapters([sea, beach, { ...development, id: "beach" }]),
    );
    expect(result.success).toBe(false);
  });

  test("rejects an empty chapter", () => {
    const [sea, beach, development] = manifest.chapters;
    const result = sequenceManifestSchema.safeParse(
      withChapters([sea, { ...beach, end: 4 }, { ...development, start: 4 }]),
    );
    expect(result.success).toBe(false);
  });
});
