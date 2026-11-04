import { z } from "zod";

// The furniture's manifest (ADR 0007, ADR 0011), written by scripts/media/build-furniture.mts next
// to its models in public/media/furniture/. Each piece faces south (+z), stands on y = 0 and is
// centred on its footprint, with its own textures: 1024 px on a desktop, 512 px on a phone.

const fileSchema = z.object({
  /** Its public URL. */
  file: z.string(),
  bytes: z.number().int().positive(),
});

const pieceSchema = z
  .object({
    /** As the plan names it: "armchair". */
    id: z.string().regex(/^[a-z]+(-[a-z]+)*$/, "English words in kebab-case"),
    /** Its size facing south, in metres: across (x), tall (y), deep (z). */
    size: z.object({
      w: z.number().positive(),
      h: z.number().positive(),
      d: z.number().positive(),
    }),
    triangles: z.number().int().positive(),
    desktop: fileSchema,
    mobile: fileSchema,
    /** Drawn on the plan as a circle. */
    round: z.boolean().optional(),
  })
  .refine(({ id, desktop }) => desktop.file === `/media/furniture/${id}.glb`, {
    message: "A piece is served from its own file in /media/furniture/",
    path: ["desktop", "file"],
  })
  .refine(({ id, mobile }) => mobile.file === `/media/furniture/${id}.mobile.glb`, {
    message: "A piece's mobile version is its own .mobile.glb",
    path: ["mobile", "file"],
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

export type FurniturePiece = z.infer<typeof pieceSchema>;
export type FurnitureManifest = z.infer<typeof furnitureManifestSchema>;
