import { z } from "zod";

// The development's site plan (ADR 0013, ADR 0015): the hillside's terraces, the beach, the road,
// a plot per unit and a zone per house type. Metres, with the house plans' axes: x grows to the
// east, z to the south, where the sea is; levels are metres over the sea.

const metres = z.number().finite();
const length = z.number().positive();

export const sitePointSchema = z.object({ x: metres, z: metres });

/** A point of the road's centre line, with its level: the road climbs in its hairpin bends. */
export const siteRoadPointSchema = sitePointSchema.extend({ y: metres });

/**
 * A level band of the hillside, flat at its level, held by a dry stone wall along its lower edge:
 * the beach and the promenade, a row of houses, the road, or a bancal of the slope above and
 * around them, planted.
 */
export const terraceSchema = z.object({
  kind: z.enum(["beach", "promenade", "row", "road", "bancal"]),
  level: metres,
  /** What grows on it, for Blender to scatter. */
  planting: z.enum(["garden", "vine", "olive", "pine", "scrub"]).optional(),
  /** Closed, without repeating the first point. */
  outline: z.array(sitePointSchema).min(3),
});

export const sitePlotSchema = z.object({
  unit: z.number().int().positive(),
  houseType: z.string().min(1),
  /** The plot's centre. */
  x: metres,
  z: metres,
  /** Turn about its centre, in degrees, clockwise seen from above; 0 keeps its plan's south to the sea. */
  rotation: metres,
  /** Its plan's mirror image, east for west: the other half of a semi-detached pair. */
  mirrored: z.boolean().optional(),
});

/** The part of the development a house type's units stand in, picked first on the aerial view. */
export const zoneSchema = z.object({
  houseType: z.string().min(1),
  /** As the visitor reads it: "Primera línea". */
  name: z.string().min(1),
  /** Closed, without repeating the first point. */
  outline: z.array(sitePointSchema).min(3),
});

export const sitePlanSchema = z.object({
  terraces: z.array(terraceSchema).min(1),
  /** Where the sand meets the water, west to east. */
  shoreline: z.array(sitePointSchema).min(2),
  /**
   * The roads: each its centre line, from one end to the other, and its width, kerb to kerb. Where
   * two meet, an end of one lies on the other.
   */
  roads: z
    .array(
      z.object({
        /** In English, for the code: "coast", "climb". */
        id: z.string().min(1),
        centre: z.array(siteRoadPointSchema).min(2),
        width: length,
      }),
    )
    .min(1),
  plots: z.array(sitePlotSchema).min(1),
  zones: z.array(zoneSchema).min(1),
});

export type SitePoint = z.infer<typeof sitePointSchema>;
export type SiteRoadPoint = z.infer<typeof siteRoadPointSchema>;
export type Terrace = z.infer<typeof terraceSchema>;
export type SitePlot = z.infer<typeof sitePlotSchema>;
export type Zone = z.infer<typeof zoneSchema>;
export type SitePlan = z.infer<typeof sitePlanSchema>;
