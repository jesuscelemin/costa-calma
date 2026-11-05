// Uploads the furniture's models to Vercel Blob (ADR 0012): IKEA's models are kept out of the
// repository, so a deploy serves them from there. Run `npm run media:furniture` first, with
// BLOB_READ_WRITE_TOKEN in the environment (`vercel env pull .env.local` writes it), then:
//
//   npm run media:furniture:upload
//
// Each .glb goes to furniture/<its name>, overwritten if it is there. It prints the base URL to
// set as NEXT_PUBLIC_FURNITURE_URL.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { put } from "@vercel/blob";

import { furnitureManifestSchema } from "../../src/features/houses/furniture-manifest.ts";

const OUT = "public/media/furniture";
const PREFIX = "furniture";
/** A day: the names stay the same when a piece is rebuilt, so a stale one lasts no longer. */
const CACHE_SECONDS = 60 * 60 * 24;

if (!process.env.BLOB_READ_WRITE_TOKEN) {
  throw new Error("BLOB_READ_WRITE_TOKEN is missing: run `vercel env pull .env.local` first");
}

// Only what the manifest serves, so a stale file left in public/ is not published.
const manifest = furnitureManifestSchema.parse(
  JSON.parse(readFileSync(join(OUT, "manifest.json"), "utf8")),
);
const files = manifest.pieces.flatMap(({ desktop, mobile }) =>
  [desktop.file, mobile.file].map((file) => file.replace(/^\/media\/furniture\//, "")),
);
const missing = files.filter((file) => !readdirSync(OUT).includes(file));
if (missing.length) throw new Error(`Missing in ${OUT}: ${missing.join(", ")}`);

let base = "";
for (const [i, file] of files.entries()) {
  const blob = await put(`${PREFIX}/${file}`, readFileSync(join(OUT, file)), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "model/gltf-binary",
    cacheControlMaxAge: CACHE_SECONDS,
  });
  base = blob.url.slice(0, blob.url.lastIndexOf("/"));
  console.log(`${String(i + 1).padStart(3)}/${files.length} ${file}`);
}
console.log(`\nNEXT_PUBLIC_FURNITURE_URL=${base}`);
