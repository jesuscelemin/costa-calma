import { describe, expect, test } from "vitest";

import { villaMarPlan } from "@/features/houses/plans/villa-mar";

import { WALL_HEIGHT } from "./model-geometry";
import { modelAt, modelPhases, phaseBounds, stopAt, stopProgress } from "./model-choreography";
import { floorLevel, tourStops, type Vec3 } from "./tour";

const plan = villaMarPlan;

describe("the house model's choreography", () => {
  test("starts on the drawing, opens the lens, sweeps it into materials and light, then tours it", () => {
    expect(modelPhases.map(({ id }) => id)).toEqual(["drawing", "lens", "sweep", "tour"]);
    const middle = (id: (typeof modelPhases)[number]["id"]) => {
      const { start, end } = phaseBounds(id);
      return (start + end) / 2;
    };
    expect(modelAt(0, plan).phase).toBe("drawing");
    expect(modelAt(middle("drawing"), plan).phase).toBe("drawing");
    expect(modelAt(middle("lens"), plan).phase).toBe("lens");
    expect(modelAt(middle("sweep"), plan).phase).toBe("sweep");
    expect(modelAt(middle("tour"), plan).phase).toBe("tour");
    expect(modelAt(1, plan).phase).toBe("tour");
  });

  test("the lens stays shut on the drawing, opens through its phase and holds open at the end", () => {
    const drawing = phaseBounds("drawing");
    for (const progress of [0, drawing.end / 2, drawing.end - 0.001]) {
      expect(modelAt(progress, plan).lens).toBe(0);
    }
    const lens = phaseBounds("lens");
    const halfway = modelAt((lens.start + lens.end) / 2, plan).lens;
    expect(halfway).toBeGreaterThan(0.2);
    expect(halfway).toBeLessThan(1);
    // The lens is open before the sweep starts, and stays open through it.
    expect(modelAt(lens.end - 0.01, plan).lens).toBe(1);
    expect(modelAt(1, plan).lens).toBe(1);
  });

  test("the sweep waits for the lens, crosses the corte through its phase and holds at the end", () => {
    const sweep = phaseBounds("sweep");
    for (const progress of [0, phaseBounds("lens").start, phaseBounds("lens").end - 0.001]) {
      expect(modelAt(progress, plan).sweep).toBe(0);
    }
    const halfway = modelAt((sweep.start + sweep.end) / 2, plan).sweep;
    expect(halfway).toBeGreaterThan(0.2);
    expect(halfway).toBeLessThan(1);
    // The last stretch of the sweep holds the house in colour, and the tour keeps it so.
    expect(modelAt(sweep.end - 0.001, plan).sweep).toBe(1);
    expect(modelAt(1, plan).sweep).toBe(1);
  });

  test("the camera holds still while the sweep crosses the corte", () => {
    const { start, end } = phaseBounds("sweep");
    expect(modelAt(start, plan).camera).toEqual(modelAt(end - 0.001, plan).camera);
  });

  test("on the drawing, the camera looks square on at the cut, framed as the SVG", () => {
    expect(modelAt(0, plan).camera).toEqual({ yaw: 0, pitch: 0, distance: 1, depth: 0 });
    expect(modelAt(phaseBounds("drawing").end - 0.001, plan).camera).toEqual(
      modelAt(0, plan).camera,
    );
  });

  test("with the lens open, it turns off the cut and looks down into the house behind it", () => {
    const { yaw, pitch, depth } = modelAt(1, plan).camera;
    expect(Math.abs(yaw)).toBeGreaterThan(0.3);
    expect(pitch).toBeGreaterThan(0.2);
    // Villa Mar runs 10,3 m east of its cut, from x = −4,3 to 6: the camera turns about its middle.
    expect(depth).toBeCloseTo(5.15);
  });

  test("the lens and the sweep only go on as the scroll goes forward, and undo as it comes back", () => {
    const steps = Array.from({ length: 201 }, (_, i) => modelAt(i / 200, plan));
    for (const [i, { lens, sweep }] of steps.entries()) {
      if (i === 0) continue;
      expect(lens).toBeGreaterThanOrEqual(steps[i - 1]!.lens);
      expect(sweep).toBeGreaterThanOrEqual(steps[i - 1]!.sweep);
    }
  });

  test("scroll outside the stretch keeps the first or the last state", () => {
    expect(modelAt(-0.5, plan)).toEqual(modelAt(0, plan));
    expect(modelAt(1.5, plan)).toEqual(modelAt(1, plan));
  });
});

describe("the tour", () => {
  const stops = tourStops(plan);
  const tour = phaseBounds("tour");
  const length = (v: Vec3) => Math.hypot(v.x, v.y, v.z);
  const towards = (from: Vec3, to: Vec3) => {
    const d = { x: to.x - from.x, y: to.y - from.y, z: to.z - from.z };
    const n = length(d);
    return { x: d.x / n, y: d.y / n, z: d.z / n };
  };

  test("has no stop before it starts, and the camera keeps to the corte until then", () => {
    for (const progress of [0, phaseBounds("lens").end, tour.start - 0.001]) {
      expect(stopAt(progress, plan)).toBeNull();
      expect(modelAt(progress, plan).tour).toMatchObject({ enter: 0, seal: 0, stop: null });
    }
  });

  test("goes through every stop in order as the scroll goes on, and back", () => {
    const seen = Array.from({ length: 1001 }, (_, i) => stopAt(i / 1000, plan));
    const order = seen.filter((stop, i) => stop !== null && stop !== seen[i - 1]);
    expect(order).toEqual(stops.map((_, i) => i));
    expect(stopAt(1, plan)).toBe(stops.length - 1);
    expect(modelAt(1, plan).tour.stop).toBe(stops.length - 1);
  });

  test("at each stop the camera stands inside its room, looking where its view looks", () => {
    stops.forEach(({ floor, room, view }, i) => {
      const progress = stopProgress(i, plan);
      const { tour: state, phase } = modelAt(progress, plan);
      expect(phase).toBe("tour");
      expect(state).toMatchObject({ stop: i, enter: 1, seal: 1 });
      const { position, target } = state.pose!;
      const level = floorLevel(plan, floor.id);
      expect(position.x, room.id).toBeGreaterThan(room.x);
      expect(position.x, room.id).toBeLessThan(room.x + room.w);
      expect(position.z, room.id).toBeGreaterThan(room.z);
      expect(position.z, room.id).toBeLessThan(room.z + room.d);
      expect(position.y, room.id).toBeGreaterThan(level);
      if (!room.open) expect(position.y, room.id).toBeLessThan(level + WALL_HEIGHT);
      const looking = towards(position, target);
      const meant = towards(view.from, view.to);
      for (const axis of ["x", "y", "z"] as const) {
        expect(looking[axis], `${room.id} ${axis}`).toBeCloseTo(meant[axis], 5);
      }
    });
  });

  test("the camera holds still at a stop for a while, then travels on to the next", () => {
    const at = stopProgress(2, plan);
    expect(modelAt(at - 0.004, plan).tour.pose).toEqual(modelAt(at + 0.004, plan).tour.pose);
    const between = (stopProgress(2, plan) + stopProgress(3, plan)) / 2;
    const { position } = modelAt(between, plan).tour.pose!;
    expect(position).not.toEqual(stops[2]!.view.from);
    expect(position).not.toEqual(stops[3]!.view.from);
  });

  test("enters through the corte: leaves the corte's camera and closes the cut behind it", () => {
    const first = stopProgress(0, plan);
    const halfway = modelAt((tour.start + first) / 2, plan).tour;
    expect(halfway.enter).toBeGreaterThan(0);
    expect(halfway.seal).toBeLessThan(1);
    // The camera turns about the corte no more: it holds as the sweep left it.
    expect(modelAt(first, plan).camera).toEqual(modelAt(tour.start - 0.001, plan).camera);
    expect(modelAt(first, plan).lens).toBe(1);
    expect(modelAt(first, plan).sweep).toBe(1);
  });
});

describe("with reduced motion", () => {
  test("goes straight to each phase's destination, with nothing in between", () => {
    const lens = phaseBounds("lens");
    const sweep = phaseBounds("sweep");
    expect(modelAt(0.01, plan, { still: true })).toEqual(modelAt(0, plan));
    for (const progress of [lens.start, (lens.start + lens.end) / 2]) {
      expect(modelAt(progress, plan, { still: true })).toEqual(modelAt(lens.end - 0.01, plan));
    }
    // The paper turns to colour at once: the scene fades to it.
    for (const progress of [sweep.start, (sweep.start + sweep.end) / 2]) {
      expect(modelAt(progress, plan, { still: true })).toEqual(modelAt(sweep.end - 0.001, plan));
    }
  });

  test("goes straight from stop to stop, without the camera's way between them", () => {
    const tour = phaseBounds("tour");
    for (let i = 0; i <= 200; i++) {
      const progress = tour.start + ((tour.end - tour.start) * i) / 200;
      const still = modelAt(progress, plan, { still: true });
      const stop = still.tour.stop!;
      expect(stop).toBe(stopAt(progress, plan, { still: true }));
      expect(still.tour).toEqual(modelAt(stopProgress(stop, plan), plan).tour);
    }
    // Before the first stop's middle, the first; after the last's, the last.
    expect(modelAt(tour.start, plan, { still: true }).tour.stop).toBe(0);
  });
});
