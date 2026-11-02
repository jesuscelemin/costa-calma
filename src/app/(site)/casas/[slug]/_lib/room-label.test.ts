import { describe, expect, test } from "vitest";

import { catalogData } from "@/features/houses/data";
import { floorGeometry, houseBounds } from "@/features/houses/plan";
import { formatArea } from "@/lib/format";

import { roomLabelLayout } from "./room-label";

// Every room of every plan is named on it, on desktop and on phones: a name that does not fit is
// a plan to fix, not a label to drop.
describe("roomLabelLayout", () => {
  const cases = catalogData.houseTypes.flatMap(({ slug, plan }) =>
    plan.floors.flatMap((floor) => {
      const frame = floor.kind === "plot" ? plan.plot : houseBounds(plan);
      const s = Math.max(frame.w, frame.d) / 12;
      return floorGeometry(floor, plan)
        .rooms.filter(({ kind }) => kind !== "stair")
        .map((room) => ({ name: `${slug} · ${floor.id} · ${room.id}`, room, s, plan }));
    }),
  );

  test.each(cases)("$name has its name on desktop and on phones", ({ room, s, plan }) => {
    const bounds = houseBounds(plan);
    const desktop = roomLabelLayout(room, {
      s,
      bounds,
      area: formatArea(room.area),
      compact: false,
    });
    const phone = roomLabelLayout(room, { s, bounds, area: null, compact: true });
    expect(desktop?.lines.join(" ")).toBe(room.name);
    expect(phone?.lines.join(" ")).toBe(room.name);
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
