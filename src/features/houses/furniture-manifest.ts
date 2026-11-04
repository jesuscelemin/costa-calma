import { z } from "zod";

// The furniture's manifest (ADR 0007), written by scripts/media/build-furniture.mts next to its
// models in public/media/furniture/. Each piece faces south (+z), stands on y = 0 and is centred
// on its footprint; its parts are named after the house's materials, which paint it in code.

/** The house's materials a piece of furniture can be made of. */
export const furnitureMaterialSchema = z.enum([
  "oak",
  "lime",
  "stone",
  "fabric",
  "frame",
  "foliage",
]);

const pieceSchema = z
  .object({
    /** As the plan names it: "armchair". */
    id: z.string().regex(/^[a-z]+(-[a-z]+)*$/, "English words in kebab-case"),
    /** Its public URL. */
    file: z.string(),
    /** Its size facing south, in metres: across (x), tall (y), deep (z). */
    size: z.object({
      w: z.number().positive(),
      h: z.number().positive(),
      d: z.number().positive(),
    }),
    materials: z.array(furnitureMaterialSchema).min(1),
    triangles: z.number().int().positive(),
    bytes: z.number().int().positive(),
    /** Drawn on the plan as a circle. */
    round: z.boolean().optional(),
  })
  .refine(({ id, file }) => file === `/media/furniture/${id}.glb`, {
    message: "A piece is served from its own file in /media/furniture/",
    path: ["file"],
  });

export const furnitureManifestSchema = z
  .object({ pieces: z.array(pieceSchema) })
  .superRefine(({ pieces }, ctx) => {
    pieces.forEach(({ id }, index) => {
      if (pieces.findIndex((piece) => piece.id === id) !== index) {
        ctx.addIssue({
          code: "custom",
          path: ["pieces", index, "id"],
          message: `Piece "${id}" is repeated`,
        });
      }
    });
  });

export type FurnitureMaterial = z.infer<typeof furnitureMaterialSchema>;
export type FurniturePiece = z.infer<typeof pieceSchema>;
export type FurnitureManifest = z.infer<typeof furnitureManifestSchema>;
