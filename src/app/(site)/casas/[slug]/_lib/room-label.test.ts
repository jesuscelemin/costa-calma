import { describe, expect, test } from "vitest";

import { catalogData } from "@/features/houses/data";
import { floorGeometry, houseBounds } from "@/features/houses/plan";
import { formatArea } from "@/lib/format";

import { roomKeys, roomLabelLayout } from "./room-label";

// Every room of every plan is named on it, on desktop and on phones: in it, or, too small for its
// name, by a number the plan's key names.
describe("roomLabelLayout", () => {
  const cases = catalogData.houseTypes.flatMap(({ slug, plan }) =>
    plan.floors.flatMap((floor) => {
      const frame = floor.kind === "plot" ? plan.plot : houseBounds(plan);
      const s = Math.max(frame.w, frame.d) / 12;
      return floorGeometry(floor, plan)
        .rooms.filter(({ kind }) => kind !== "stair")
        .map((room) => ({
          name: `${slug} · ${floor.id} · ${room.id}`,
          room,
          s,
          plan,
          keyOf: (r: typeof room, compact: boolean) =>
            roomKeys(floorGeometry(floor, plan).rooms, {
              s,
              bounds: houseBounds(plan),
              compact,
            }).get(r.id),
        }));
    }),
  );

  test.each(cases)("$name has its name on desktop and on phones", ({ room, s, plan, keyOf }) => {
    const bounds = houseBounds(plan);
    const desktop = roomLabelLayout(room, {
      s,
      bounds,
      area: formatArea(room.area),
      compact: false,
    });
    const phone = roomLabelLayout(room, { s, bounds, area: null, compact: true });
    expect(desktop?.lines.join(" ") ?? keyOf(room, false)).toBeTruthy();
    expect(phone?.lines.join(" ") ?? keyOf(room, true)).toBeTruthy();
    if (desktop) expect(desktop.lines.join(" ")).toBe(room.name);
    if (phone) expect(phone.lines.join(" ")).toBe(room.name);
  });

  test("a stair has no label: its treads say what it is", () => {
    const plan = catalogData.houseTypes[0]!.plan;
    const stair = plan.floors
      .flatMap((floor) => floorGeometry(floor, plan).rooms)
      .find(({ kind }) => kind === "stair");
    expect(stair).toBeDefined();
    expect(
      roomLabelLayout(stair!, { s: 1, bounds: houseBounds(plan), area: null, compact: false }),
    ).toBeNull();
  });
});

describe("roomKeys", () => {
  test("numbers, in order, only the rooms too small for their name", () => {
    const plan = catalogData.houseTypes.find(({ slug }) => slug === "villa-duna-blanca")!.plan;
    const plot = plan.floors[0]!;
    const keys = roomKeys(floorGeometry(plot, plan).rooms, {
      s: Math.max(plan.plot.w, plan.plot.d) / 12,
      bounds: houseBounds(plan),
      compact: false,
    });
    expect([...keys]).toEqual([
      ["lamina-oeste", 1],
      ["paso-entrada", 2],
      ["lamina-este", 3],
      ["terraza-salon", 4],
    ]);
  });
});
