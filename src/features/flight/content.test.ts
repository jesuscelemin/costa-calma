import { expect, test } from "vitest";

import { flightChapterCopy } from "./content";
import { flightManifest } from "./manifest";

// The copy is joined to the videos by chapter id, so new clips or new copy cannot drift apart.
test("every chapter of the flight has its copy, and there is no copy without a chapter", () => {
  expect(Object.keys(flightChapterCopy).sort()).toEqual(
    flightManifest.chapters.map(({ id }) => id).sort(),
  );
});
