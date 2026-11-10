import { z } from "zod";

import { planFigures, validatePlan } from "./plan.ts";

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

// A house type's plan (ADR 0006): every room a rectangle in metres, every opening declared by
// hand. Axes: x grows to the east, z to the south (the sea), as in SVG, where z is y.

const metres = z.number().finite();
const length = z.number().positive();

const rectSchema = z.object({ x: metres, z: metres, w: length, d: length });

/** A point in a floor, `y` metres over its finished floor. */
const pointSchema = z.object({ x: metres, y: metres, z: metres });

/** Where a camera stands in a room, and what it looks at: an eye and a point, over its floor. */
const viewSchema = z.object({ from: pointSchema, to: pointSchema });

export const roomKindSchema = z.enum([
  "hall",
  "corridor",
  "stair",
  "living",
  "dining",
  "kitchen",
  "utility",
  "bedroom",
  "dressing",
  "bath",
  /** A guest toilet: a WC and a basin, no shower. Counted apart from the bathrooms. */
  "toilet",
  "study",
  /** A home gym. */
  "gym",
  /** A wellness room: a sauna, a steam room and their shower. */
  "spa",
  /** A lift's shaft, in the same place on every floor it serves. */
  "lift",
  "terrace",
  "solarium",
  "lounge",
  "planter",
  "deck",
  "pool",
  /** Water that is not the pool: a jacuzzi, a reflecting basin, a fountain's sheet. */
  "water",
  /** On the plot: parking for cars, open or under a pergola. */
  "garage",
  "garden",
  /** On the plot: a courtyard the house wraps around. */
  "patio",
  /**
   * On a storey above the ground: a double height, the slab left open over a room of the floor
   * below, or over a porch of the plot. No floor of its own, so no m² of its own; a railing where
   * it meets the storey's rooms.
   */
  "void",
]);

export const sideSchema = z.enum(["north", "south", "east", "west"]);

/**
 * A piece of furniture placed in a room by hand (ADR 0007): one of the furniture's manifest, its
 * footprint centred on a point of the plan, on the floor or on another piece, its front facing
 * one way.
 */
const furnitureSchema = z.object({
  /** The manifest's id: "armchair". */
  piece: z.string().min(1),
  x: metres,
  z: metres,
  /** How high it stands over the floor: on a table, or hung from the ceiling. */
  y: z.number().nonnegative().optional(),
  /** Where its front looks: a sofa facing the sea faces south. */
  facing: sideSchema,
});

export const orientationSchema = z.enum(["Norte", "Sur", "Este", "Oeste", "Sureste", "Suroeste"]);

const roomSchema = rectSchema.extend({
  /** Stable id, in Spanish like the room's name: "salon", "bano-suite". */
  id: z.string().min(1),
  name: z.string().min(1),
  kind: roomKindSchema,
  orientation: orientationSchema,
  /** Open-air: no walls of its own (the roof terrace, the porch). */
  open: z.boolean().optional(),
  /**
   * For the plot's garden: the plot is its rectangle and it takes what the house, the porch and
   * the pool leave, so its m² are declared and the plan checks they add up. Any other room that
   * declares them must declare its rectangle's.
   */
  area: z.number().positive().optional(),
  /** On the plot: a tree standing in it, where its trunk meets the ground. */
  tree: z.object({ x: metres, z: metres }).optional(),
  /** A built-in wardrobe inside the room, against one of its walls. */
  wardrobe: rectSchema.optional(),
  /**
   * Its view, set by hand where the one worked out from the plan (from its main door, at eye
   * height, towards its main window) does not show what matters.
   */
  view: viewSchema.optional(),
  /** Its furniture, placed by hand; without it, what the plan draws for its kind. */
  furniture: z.array(furnitureSchema).optional(),
});

const openingBase = {
  /** The wall: this side of this room. Across it lies another room or the outside. */
  room: z.string().min(1),
  side: sideSchema,
  /** Centre of the opening along the wall: x on a north or south wall, z on an east or west one. */
  at: metres,
  width: length,
};

const swingSchema = {
  /** Into `room` ("in") or into what lies across the wall ("out"). */
  opens: z.enum(["in", "out"]),
  /** The end of the opening the leaf hangs from, as a compass point along the wall. */
  hinge: sideSchema,
};

export const openingSchema = z.discriminatedUnion("kind", [
  /** A swinging door between two rooms. */
  z.object({ kind: z.literal("door"), ...openingBase, ...swingSchema }),
  /** The front door, from the outside into the hall. */
  z.object({ kind: z.literal("entrance"), ...openingBase, ...swingSchema }),
  /** A doorless opening between two rooms. */
  z.object({ kind: z.literal("passage"), ...openingBase }),
  /** A sliding glass door onto the outside or an open-air room. */
  z.object({ kind: z.literal("sliding"), ...openingBase }),
  /** A window on an outer wall; a sill of 1,5 m or more makes it a high window. */
  z.object({ kind: z.literal("window"), ...openingBase, sill: z.number().nonnegative() }),
]);

/** A shade at the top of a floor: its roof slab running past the walls, or a pergola. */
const canopySchema = rectSchema.extend({ kind: z.enum(["eave", "pergola"]) });

const planFloorSchema = floorSchema.extend({
  rooms: z.array(roomSchema).min(1),
  openings: z.array(openingSchema),
  canopies: z.array(canopySchema).optional(),
});

/**
 * The vertical plane the house is drawn cut by, its corte: north–south at x = `at`, seen from the
 * west, with the north on the left and the sea on the right; or east–west at z = `at`, seen from the
 * sea, with the west on the left.
 */
const sectionSchema = z.object({ runs: z.enum(["north-south", "east-west"]), at: metres });

/** A point the tour's camera passes on its way, over a floor: at eye height unless `y` says. */
const pathPointSchema = z.object({
  floor: z.string().min(1),
  x: metres,
  z: metres,
  y: metres.optional(),
});

/** A stop of the tour: one room, its line for the cartela, and how the camera gets there. */
const stopSchema = z.object({
  floor: z.string().min(1),
  room: z.string().min(1),
  /** The cartela's sentence. */
  line: z.string().min(1),
  /** Its view, set by hand; otherwise the room's. */
  view: viewSchema.optional(),
  /** The way from the stop before, or in through the corte for the first, as the tour declares it. */
  via: z.array(pathPointSchema).optional(),
});

export const planSchema = z.object({
  /**
   * The plot the house stands on. The house is its rooms: each storey takes the shape its rooms
   * give it, so one can overhang the one below or step back from it (ADR 0008).
   */
  plot: rectSchema,
  /**
   * One half of a semi-detached pair: the plot's edge it shares with its neighbour, where its outer
   * walls are a blind party wall.
   */
  partyWall: sideSchema.optional(),
  /** In order, from the plot up. */
  floors: z.array(planFloorSchema).min(1),
  /** Where the house is cut for its corte, if it has one. */
  section: sectionSchema.optional(),
  /** The tour through its model (ADR 0009): its stops, in order. */
  tour: z.array(stopSchema).min(1).optional(),
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
    /** Guest toilets, apart from the bathrooms: «2 baños y 1 aseo». */
    toilets: z.number().int().nonnegative(),
  }),
  /**
   * The title over its model's sheet, ending on its accent word, «De la puerta al *mar*», and its
   * line: what the walk from the front door goes through. The sheet adds how to walk it.
   */
  sheetHeading: z.object({
    lead: z.string().min(1),
    accent: z.string().min(1),
    line: z.string().min(1),
  }),
  /** Whether its guided tours exist yet; otherwise it shows «Tour próximamente». */
  hasTour: z.boolean(),
  floors: z.array(floorSchema).min(1),
  /** Its plan (ADR 0006): its floors and figures are the plan's. */
  plan: planSchema,
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
    houseTypes.forEach(({ slug, floors, figures, plan }, index) => {
      for (const message of validatePlan(plan)) {
        ctx.addIssue({ code: "custom", path: ["houseTypes", index, "plan"], message });
      }
      const sameFloors =
        plan.floors.length === floors.length &&
        plan.floors.every(
          (floor, i) =>
            floor.id === floors[i]?.id &&
            floor.name === floors[i]?.name &&
            floor.kind === floors[i]?.kind,
        );
      if (!sameFloors) {
        ctx.addIssue({
          code: "custom",
          path: ["houseTypes", index, "floors"],
          message: `The floors of "${slug}" are not its plan's`,
        });
      }
      const planned = planFigures(plan);
      const sameFigures = (Object.keys(planned) as (keyof typeof planned)[]).every(
        (key) => planned[key] === figures[key],
      );
      if (!sameFigures) {
        ctx.addIssue({
          code: "custom",
          path: ["houseTypes", index, "figures"],
          message: `The figures of "${slug}" are not its plan's`,
        });
      }
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

export type Rect = z.infer<typeof rectSchema>;
export type RoomKind = z.infer<typeof roomKindSchema>;
export type Orientation = z.infer<typeof orientationSchema>;
export type Room = z.infer<typeof roomSchema>;
export type Side = z.infer<typeof sideSchema>;
export type Furniture = z.infer<typeof furnitureSchema>;
export type Opening = z.infer<typeof openingSchema>;
export type Canopy = z.infer<typeof canopySchema>;
export type PlanFloor = z.infer<typeof planFloorSchema>;
export type SectionPlane = z.infer<typeof sectionSchema>;
export type PlanPoint = z.infer<typeof pointSchema>;
export type PlanView = z.infer<typeof viewSchema>;
export type PathPoint = z.infer<typeof pathPointSchema>;
export type PlanStop = z.infer<typeof stopSchema>;
export type HousePlan = z.infer<typeof planSchema>;
export type UnitStatus = z.infer<typeof unitStatusSchema>;
export type HouseType = z.infer<typeof houseTypeSchema>;
export type SheetHeading = HouseType["sheetHeading"];
export type Floor = HouseType["floors"][number];
export type Unit = z.infer<typeof unitSchema>;
export type CatalogData = z.infer<typeof catalogDataSchema>;
