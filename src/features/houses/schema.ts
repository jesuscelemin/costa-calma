import { z } from "zod";

// The development's house types and units. Static data in Phase 3 (data.ts), the seed of the
// database in Phase 5: these schemas are the shape both have to keep.

export const unitStatusSchema = z.enum(["available", "reserved", "sold"]);

const slugSchema = z.string().regex(/^[a-z]+(-[a-z]+)*$/, "Spanish words in kebab-case");

const floorSchema = z.object({
  /** Stable id, in English: "plot", "ground", "first", "roof". */
  id: z.string().min(1),
  /** As the visitor reads it: "Planta baja". */
  name: z.string().min(1),
  /** The plot is the model's base and the tour's first floor; the roof terrace is the top one. */
  kind: z.enum(["plot", "storey", "roof"]),
});

export const houseTypeSchema = z.object({
  slug: slugSchema,
  name: z.string().min(1),
  /** The name as a title, ending on its accent word: "Villa *Mar*". */
  title: z.object({ lead: z.string().min(1), accent: z.string().min(1) }),
  /** What kind of house it is, in a few words: "Villa independiente". */
  kind: z.string().min(1),
  /** Two-tone statement: the lead in ink-muted, the rest in ink. */
  statement: z.object({ lead: z.string().min(1), rest: z.string().min(1) }),
  /** One or two sentences for the page's metadata and its presentation. */
  description: z.string().min(1),
  figures: z.object({
    /** Built area, m². */
    builtArea: z.number().positive(),
    /** Plot area, m². */
    plotArea: z.number().positive(),
    bedrooms: z.number().int().positive(),
    bathrooms: z.number().int().positive(),
  }),
  /** Whether its guided tours exist yet; otherwise it shows «Tour próximamente». */
  hasTour: z.boolean(),
  floors: z.array(floorSchema).min(1),
});

export const unitSchema = z.object({
  /** The unit's number in the development, 1 to 12. */
  number: z.number().int().positive(),
  houseType: slugSchema,
  /** Euros. */
  price: z.number().int().positive(),
  status: unitStatusSchema,
});

export const catalogDataSchema = z
  .object({
    houseTypes: z.array(houseTypeSchema).min(1),
    units: z.array(unitSchema),
  })
  .superRefine(({ houseTypes, units }, ctx) => {
    const slugs = houseTypes.map(({ slug }) => slug);
    houseTypes.forEach(({ slug, floors }, index) => {
      if (slugs.indexOf(slug) !== index) {
        ctx.addIssue({
          code: "custom",
          path: ["houseTypes", index, "slug"],
          message: `House type "${slug}" is repeated`,
        });
      }
      const floorIds = floors.map(({ id }) => id);
      floorIds.forEach((id, floor) => {
        if (floorIds.indexOf(id) !== floor) {
          ctx.addIssue({
            code: "custom",
            path: ["houseTypes", index, "floors", floor, "id"],
            message: `Floor "${id}" of "${slug}" is repeated`,
          });
        }
      });
    });
    units.forEach((unit, index) => {
      if (!slugs.includes(unit.houseType)) {
        ctx.addIssue({
          code: "custom",
          path: ["units", index, "houseType"],
          message: `Unit ${unit.number} has an unknown house type "${unit.houseType}"`,
        });
      }
      if (units.findIndex(({ number }) => number === unit.number) !== index) {
        ctx.addIssue({
          code: "custom",
          path: ["units", index, "number"],
          message: `Unit number ${unit.number} is repeated`,
        });
      }
    });
  });

export type UnitStatus = z.infer<typeof unitStatusSchema>;
export type HouseType = z.infer<typeof houseTypeSchema>;
export type Floor = HouseType["floors"][number];
export type Unit = z.infer<typeof unitSchema>;
export type CatalogData = z.infer<typeof catalogDataSchema>;
