import manifest from "../../../public/media/furniture/manifest.json";
import { type FurniturePiece, furnitureManifestSchema } from "./furniture-manifest";
import type { Furniture, Rect } from "./schema";

// The furniture the plans place by hand (ADR 0007): the pieces the furniture script built, by id,
// and where each one stands on the plan.

// Written by `npm run media:furniture`; rebuilding the pieces only rewrites this JSON.
export const furnitureManifest = furnitureManifestSchema.parse(manifest);

/** What the plan needs to know of a piece: its size, facing south, and whether it is round. */
export type FurnitureCatalog = Readonly<Record<string, Pick<FurniturePiece, "size" | "round">>>;

/** Each piece of the manifest, by its id. */
export const furniturePieces: Readonly<Record<string, FurniturePiece>> = Object.fromEntries(
  furnitureManifest.pieces.map((piece) => [piece.id, piece]),
);

/**
 * Where a piece's file is served from (ADR 0012): IKEA's models are kept out of the repository,
 * so a deploy serves them from the storage NEXT_PUBLIC_FURNITURE_URL names; locally, from
 * public/media/furniture/, where the furniture script writes them.
 */
export function furnitureUrl(file: string): string {
  const base = process.env.NEXT_PUBLIC_FURNITURE_URL?.replace(/\/$/, "");
  return base ? `${base}${file.replace(/^\/media\/furniture/, "")}` : file;
}

/** The rectangle a piece takes on the plan, turned the way it faces. */
export function footprint(
  { x, z, facing }: Furniture,
  { size }: Pick<FurniturePiece, "size">,
): Rect {
  const across = facing === "east" || facing === "west";
  const w = across ? size.d : size.w;
  const d = across ? size.w : size.d;
  return { x: x - w / 2, z: z - d / 2, w, d };
}

/** The angle a piece turns about the vertical, from facing south, as Three.js turns it. */
export const FACING_TURN: Record<Furniture["facing"], number> = {
  south: 0,
  east: Math.PI / 2,
  north: Math.PI,
  west: -Math.PI / 2,
};
