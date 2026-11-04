import manifest from "../../../public/media/furniture/manifest.json";
import { type FurniturePiece, furnitureManifestSchema } from "./furniture-manifest";
import type { Furniture, Rect } from "./schema";

// The furniture the plans place by hand (ADR 0007): the pieces the furniture script built, by id,
// and where each one stands on the plan.

// Written by `npm run media:furniture`; rebuilding the pieces only rewrites this JSON.
export const furnitureManifest = furnitureManifestSchema.parse(manifest);

/** What the plan needs to know of a piece: its size, facing south. */
export type FurnitureCatalog = Record<string, Pick<FurniturePiece, "size"> & { round?: boolean }>;

export const furnitureCatalog: FurnitureCatalog = Object.fromEntries(
  furnitureManifest.pieces.map((piece) => [piece.id, piece]),
);

/** Each piece, by its id, with its file. */
export const furniturePieces: ReadonlyMap<string, FurniturePiece> = new Map(
  furnitureManifest.pieces.map((piece) => [piece.id, piece]),
);

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
