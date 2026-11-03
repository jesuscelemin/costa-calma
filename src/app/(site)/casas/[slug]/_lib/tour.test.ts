import { describe, expect, test } from "vitest";

import { floorGeometry } from "@/features/houses/plan";
import { casaDunaPlan } from "@/features/houses/plans/casa-duna";
import { casaPinarPlan } from "@/features/houses/plans/casa-pinar";
import { villaMarPlan } from "@/features/houses/plans/villa-mar";
import type { HousePlan } from "@/features/houses/schema";

import { STOREY_HEIGHT, WALL_HEIGHT } from "./model-geometry";
import { EYE_HEIGHT, floorLevel, roomViewpoint, tourStops } from "./tour";

const plans = { "Villa Mar": villaMarPlan, "Casa Pinar": casaPinarPlan, "Casa Duna": casaDunaPlan };

const NBSP = " ";
// The front door is a door: a hall looks into the house from it, not back at it.
const EXTERIOR = ["window", "sliding"];

/** Whether a point on the plan lies on an opening's gap, as the plan draws it. */
const onGap = (
  { x, z }: { x: number; z: number },
  { x1, z1, x2, z2 }: { x1: number; z1: number; x2: number; z2: number },
) =>
  x >= Math.min(x1, x2) - 1e-6 &&
  x <= Math.max(x1, x2) + 1e-6 &&
  z >= Math.min(z1, z2) - 1e-6 &&
  z <= Math.max(z1, z2) + 1e-6;

describe("each room's view worked out from its plan", () => {
  for (const [name, plan] of Object.entries(plans) as [string, HousePlan][]) {
    test(`${name}: stands inside its room at eye height, and looks at an opening onto the outside if it has one`, () => {
      for (const floor of plan.floors) {
        const { openings } = floorGeometry(floor, plan);
        const level = floorLevel(plan, floor.id);
        for (const room of floor.rooms) {
          if (room.kind === "garden" || room.kind === "void") continue;
          const { from, to } = roomViewpoint(plan, floor, { ...room, view: undefined });
          const where = `${floor.id}/${room.id}`;
          expect(from.x, where).toBeGreaterThan(room.x);
          expect(from.x, where).toBeLessThan(room.x + room.w);
          expect(from.z, where).toBeGreaterThan(room.z);
          expect(from.z, where).toBeLessThan(room.z + room.d);
          expect(from.y, where).toBeCloseTo(level + EYE_HEIGHT);
          const outer = openings.filter(
            (opening) =>
              EXTERIOR.includes(opening.kind) &&
              (opening.room === room.id ||
                [
                  { x: opening.x1, z: opening.z1 },
                  { x: opening.x2, z: opening.z2 },
                ].every(
                  ({ x, z }) =>
                    x >= room.x - 1e-6 &&
                    x <= room.x + room.w + 1e-6 &&
                    z >= room.z - 1e-6 &&
                    z <= room.z + room.d + 1e-6,
                )),
          );
          if (outer.length > 0) {
            expect(
              outer.some((opening) => onGap(to, opening)),
              `${where} looks at its opening onto the outside`,
            ).toBe(true);
          }
        }
      }
    });
  }

  test("the living room is seen from its passage to the dining room, towards its sliding door", () => {
    const ground = villaMarPlan.floors.find(({ id }) => id === "ground")!;
    const salon = ground.rooms.find(({ id }) => id === "salon")!;
    const { from, to } = roomViewpoint(villaMarPlan, ground, salon);
    // The passage is in its east wall, x = −0,4, from z = 0 to 4; the sliding door in its south
    // wall, z = 5, from x = −5 to −1,4.
    expect(from.z).toBeCloseTo(2);
    expect(from.x).toBeGreaterThan(-1.4);
    expect(from.x).toBeLessThan(-0.4);
    expect(to.z).toBeCloseTo(5);
    expect(to.x).toBeCloseTo(-3.2);
  });

  test("a view set by hand on a room wins, over the room's floor", () => {
    const first = villaMarPlan.floors.find(({ id }) => id === "first")!;
    const suite = first.rooms.find(({ id }) => id === "suite")!;
    const view = { from: { x: 0, y: 1.5, z: 0 }, to: { x: 2, y: 1, z: 3 } };
    expect(roomViewpoint(villaMarPlan, first, { ...suite, view })).toEqual({
      from: { x: 0, y: STOREY_HEIGHT + 1.5, z: 0 },
      to: { x: 2, y: STOREY_HEIGHT + 1, z: 3 },
    });
  });
});

describe("Villa Mar's tour", () => {
  const stops = tourStops(villaMarPlan);

  test("stops at its eight rooms, in order, each a real room of its floor", () => {
    expect(stops.map(({ floor, room }) => `${floor.id}/${room.id}`)).toEqual([
      "ground/recibidor",
      "ground/salon",
      "ground/comedor",
      "ground/escalera",
      "first/galeria",
      "first/suite",
      "roof/solarium",
      "plot/porche",
    ]);
  });

  test("each stop's camera stands inside its room, under its ceiling", () => {
    for (const { floor, room, view } of stops) {
      const level = floorLevel(villaMarPlan, floor.id);
      expect(view.from.x, room.id).toBeGreaterThan(room.x);
      expect(view.from.x, room.id).toBeLessThan(room.x + room.w);
      expect(view.from.z, room.id).toBeGreaterThan(room.z);
      expect(view.from.z, room.id).toBeLessThan(room.z + room.d);
      expect(view.from.y, room.id).toBeGreaterThan(level);
      if (!room.open) expect(view.from.y, room.id).toBeLessThan(level + WALL_HEIGHT);
    }
  });

  test("the cartelas take their figures from the plan, each unit after a no-break space", () => {
    const salon = stops[1]!.caption;
    expect(salon).toMatchObject({
      name: "Salón",
      area: `33,6${NBSP}m²`,
      orientation: "orientación suroeste",
      fact: `6,4${NBSP}m de altura`,
    });
    expect(salon.line.length).toBeGreaterThan(0);
    expect(stops[7]!.caption).toMatchObject({ name: "Porche", area: `36${NBSP}m²` });
    // Only a double height has a figure of its own here.
    expect(stops[0]!.caption.fact).toBeUndefined();
  });

  test("the way between stops goes up the stair from the ground floor to the first", () => {
    const way = stops[4]!.path;
    // From the foot of the stair, over its landing, to the first floor.
    expect(way.some(({ y }) => y > EYE_HEIGHT + 1)).toBe(true);
    expect(way.at(-1)).toEqual(stops[4]!.view.from);
    expect(way[0]).toEqual(stops[3]!.view.from);
  });
});
