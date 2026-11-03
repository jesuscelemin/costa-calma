import { describe, expect, test } from "vitest";

import { villaMarPlan } from "@/features/houses/plans/villa-mar";

import {
  modelAt,
  modelPhases,
  NO_CUT,
  phaseBounds,
  SHEET_CUT,
  SHEET_FOV,
  modelUnits,
  stopAt,
  stopProgress,
  walkActions,
  WALK_FOV,
  type ModelState,
} from "./model-choreography";
import { floorModel, WALL_HEIGHT, type Box } from "./model-geometry";
import { revealRooms } from "./room-reveal";
import { entranceOf, EYE_HEIGHT, floorLevel, tourStops, type Vec3 } from "./tour";

const plan = villaMarPlan;
const stops = tourStops(plan);
const rooms = revealRooms(plan);
const entrance = entranceOf(plan)!;
const tour = phaseBounds("tour", plan);
const samples = (from: number, to: number, count: number) =>
  Array.from({ length: count + 1 }, (_, i) => from + ((to - from) * i) / count);
const length = (v: Vec3) => Math.hypot(v.x, v.y, v.z);
const towards = (from: Vec3, to: Vec3) => {
  const d = { x: to.x - from.x, y: to.y - from.y, z: to.z - from.z };
  const n = length(d);
  return { x: d.x / n, y: d.y / n, z: d.z / n };
};
const reveal = (state: ModelState, key: string) =>
  state.rooms[rooms.findIndex((room) => room.key === key)]!.reveal;
/** How tall the camera's frame is where it looks, in metres. */
const frameOf = ({ camera }: ModelState) =>
  2 *
  length({
    x: camera.target.x - camera.position.x,
    y: camera.target.y - camera.position.y,
    z: camera.target.z - camera.position.z,
  }) *
  Math.tan((camera.fov * Math.PI) / 360);

describe("from above", () => {
  test("goes from the sheet to the lift, the descent and the tour", () => {
    expect(modelPhases.map(({ id }) => id)).toEqual(["sheet", "lift", "descent", "tour", "finale"]);
    for (const { id } of modelPhases) {
      const { start, end } = phaseBounds(id, plan);
      expect(modelAt((start + end) / 2, plan).phase).toBe(id);
    }
    expect(modelAt(1, plan).phase).toBe("finale");
  });

  test("on the sheet, looks straight down with a 2° lens at the ground floor cut at +1,20 m", () => {
    const { end } = phaseBounds("sheet", plan);
    for (const progress of [0, end / 2, end - 0.001]) {
      const state = modelAt(progress, plan);
      const { position, target, fov } = state.camera;
      expect(fov).toBeCloseTo(SHEET_FOV);
      expect(towards(position, target).y).toBeLessThan(-0.999);
      expect(state.cut).toBe(SHEET_CUT);
      expect(state.rooms.every(({ reveal }) => reveal === 0)).toBe(true);
      expect(state.stop).toBeNull();
    }
  });

  test("the walls rise, then the floors above, and the house is whole on foot", () => {
    const cuts = samples(0, tour.start, 400).map((p) => modelAt(p, plan).cut);
    for (let i = 1; i < cuts.length; i++) expect(cuts[i]).toBeGreaterThanOrEqual(cuts[i - 1]!);
    expect(modelAt(phaseBounds("descent", plan).start, plan).cut).toBeLessThan(WALL_HEIGHT);
    expect(modelAt(tour.start, plan).cut).toBe(NO_CUT);
    expect(modelAt(tour.end - 0.0001, plan).cut).toBe(NO_CUT);
  });

  test("the frame never jumps: the lens opens as the distance shrinks, step by step", () => {
    // Up to the landing: on foot the camera looks at a point nearer ahead, along the same line.
    const states = samples(0, tour.start - 1e-7, 2000).map((p) => modelAt(p, plan));
    for (let i = 1; i < states.length; i++) {
      const [a, b] = [states[i - 1]!, states[i]!];
      expect(frameOf(b) / frameOf(a)).toBeLessThan(1.02);
      expect(frameOf(b) / frameOf(a)).toBeGreaterThan(0.98);
      expect(Math.abs(b.camera.fov - a.camera.fov)).toBeLessThan(0.2);
    }
  });

  test("lands at eye height in front of the door, looking in, with the tour's lens", () => {
    const { position, target, fov } = modelAt(tour.start, plan).camera;
    expect(position.x).toBeCloseTo(entrance.landing.x, 3);
    expect(position.y).toBeCloseTo(EYE_HEIGHT, 3);
    expect(position.z).toBeCloseTo(entrance.landing.z, 3);
    // Villa Mar's door is on the north: the camera looks south, level, through it.
    expect(towards(position, target)).toMatchObject({ x: expect.closeTo(0), z: expect.closeTo(1) });
    expect(fov).toBe(WALK_FOV);
    // And it does not jump on to its feet.
    const before = modelAt(tour.start - 0.0005, plan).camera.position;
    expect(length({ x: before.x - position.x, y: before.y - position.y, z: 0 })).toBeLessThan(0.3);
  });
});

describe("on foot", () => {
  const walk = samples(tour.start, tour.end - 1e-6, 6000).map((p) => modelAt(p, plan));

  test("never walks through a wall: only through the openings", () => {
    const storeys = plan.floors.filter(({ kind }) => kind !== "plot");
    const walls: Box[] = storeys.flatMap((floor, i) => {
      const level = floorLevel(plan, floor.id);
      const model = floorModel(plan, floor, { next: storeys[i + 1], below: storeys[i - 1] });
      return model.walls.map((box) => ({ ...box, y: box.y + level }));
    });
    const inWall = ({ x, y, z }: Vec3) =>
      walls.find(
        (b) =>
          x > b.x + 0.02 &&
          x < b.x + b.w - 0.02 &&
          z > b.z + 0.02 &&
          z < b.z + b.d - 0.02 &&
          y > b.y &&
          y < b.y + b.h,
      );
    for (const { camera } of walk)
      expect(inWall(camera.position), JSON.stringify(camera)).toBe(undefined);
  });

  test("turns only standing still, and walks without turning", () => {
    const moved = (a: ModelState, b: ModelState) =>
      length({
        x: b.camera.position.x - a.camera.position.x,
        y: b.camera.position.y - a.camera.position.y,
        z: b.camera.position.z - a.camera.position.z,
      }) > 1e-7;
    const turned = (a: ModelState, b: ModelState) => {
      const [da, db] = [
        towards(a.camera.position, a.camera.target),
        towards(b.camera.position, b.camera.target),
      ];
      return Math.hypot(db.x - da.x, db.y - da.y, db.z - da.z) > 1e-7;
    };
    /** Whether the camera walks and turns at once between two points: halving to tell a step
     * that straddles the end of a turn and the start of a walk from one that does both. */
    const both = (p: number, q: number, depth = 0): boolean => {
      const [a, b] = [modelAt(p, plan), modelAt(q, plan)];
      if (!moved(a, b) || !turned(a, b)) return false;
      if (depth === 12) return true;
      const m = (p + q) / 2;
      return both(p, m, depth + 1) || both(m, q, depth + 1);
    };
    const points = samples(tour.start, tour.end - 1e-6, 3000);
    for (let i = 1; i < points.length; i++) {
      expect(both(points[i - 1]!, points[i]!), `at ${points[i]}`).toBe(false);
    }
  });

  test("walks straight in from the landing through the front door to the hall", () => {
    const hall = stops[0]!;
    expect(hall.room.id).toBe("recibidor");
    const until = stopProgress(0, plan);
    for (const state of walk.filter(
      (_, i) => tour.start + ((1 - tour.start) * i) / 6000 <= until,
    )) {
      expect(state.camera.position.x).toBeCloseTo(entrance.door.x, 5);
    }
  });

  test("the door swings open as the camera comes near, and is open when it gets there", () => {
    expect(modelAt(tour.start, plan).door).toBe(0);
    const crossing = walk.find(({ camera }) => camera.position.z > entrance.door.z - 0.3)!;
    expect(crossing.door).toBe(1);
    expect(modelAt(stopProgress(0, plan), plan).door).toBe(1);
  });

  test("each room turns into colour as the camera crosses into it, and not before", () => {
    const landed = modelAt(tour.start, plan);
    expect(landed.rooms.every(({ reveal }) => reveal === 0)).toBe(true);
    const outside = walk.filter(({ camera }) => camera.position.z < entrance.door.z - 0.05);
    for (const state of outside) expect(reveal(state, "ground/recibidor")).toBe(0);
    const inHall = modelAt(stopProgress(0, plan), plan);
    expect(reveal(inHall, "ground/recibidor")).toBe(1);
    expect(inHall.rooms.find((_, i) => rooms[i]!.key === "ground/recibidor")!.axis).toBe("+z");
    // The living room is still ink until it is walked into; the study, until the end.
    expect(reveal(inHall, "ground/salon")).toBe(0);
    expect(reveal(modelAt(stopProgress(1, plan), plan), "ground/salon")).toBeGreaterThan(0);
    expect(reveal(modelAt(tour.end - 0.0001, plan), "ground/estudio")).toBe(0);
    expect(reveal(modelAt(1, plan), "ground/estudio")).toBe(1);
    // Outside is in colour from the hall on: the windows look out onto it.
    expect(reveal(landed, "plot/jardin")).toBe(0);
    expect(reveal(inHall, "plot/jardin")).toBe(1);
  });

  test("the sweeps only go on as the scroll goes forward, and undo as it comes back", () => {
    for (let i = 1; i < walk.length; i++) {
      walk[i]!.rooms.forEach(({ reveal }, r) =>
        expect(reveal).toBeGreaterThanOrEqual(walk[i - 1]!.rooms[r]!.reveal),
      );
    }
  });
});

describe("the finale", () => {
  const finale = phaseBounds("finale", plan);

  test("rises from the last stop over the whole house, all of it in colour", () => {
    const end = modelAt(1, plan);
    expect(end.phase).toBe("finale");
    expect(end.stop).toBeNull();
    expect(end.rooms.every(({ reveal }) => reveal === 1)).toBe(true);
    expect(end.camera.position.y).toBeGreaterThan(15);
    expect(end.cut).toBe(NO_CUT);
    // And it starts where the last stop left it, without a jump.
    const before = modelAt(finale.start - 1e-6, plan).camera.position;
    const after = modelAt(finale.start + 1e-6, plan).camera.position;
    expect(
      length({ x: after.x - before.x, y: after.y - before.y, z: after.z - before.z }),
    ).toBeLessThan(0.05);
  });
});

describe("the tour", () => {
  test("has no stop before the hall is reached", () => {
    for (const p of [0, phaseBounds("descent", plan).end - 0.001, tour.start]) {
      expect(stopAt(p, plan)).toBeNull();
    }
  });

  test("goes through every stop in order as the scroll goes on", () => {
    const seen = samples(0, 1, 2000).map((p) => stopAt(p, plan));
    const order = seen.filter((stop, i) => stop !== null && stop !== seen[i - 1]);
    expect(order).toEqual(stops.map((_, i) => i));
    expect(stopAt(tour.end - 0.0001, plan)).toBe(stops.length - 1);
  });

  test("walks each stretch in few straight lines: it only turns where the house makes it", () => {
    const actions = walkActions(plan);
    const turns = actions.filter(({ kind }) => kind === "turn").length;
    const walks = actions.filter(({ kind }) => kind === "walk");
    const metres = walks.reduce((sum, { units }) => sum + units, 0);
    // Six stops, a U stair and the way out to the terrace: under five turns a stop, the stop's
    // own turn included.
    expect(turns).toBeLessThan(stops.length * 5);
    // And no zigzags: each straight stretch is a walk worth its name.
    expect(metres / walks.length).toBeGreaterThan(1.8);
  });

  test("the whole stretch is a walk, not a march", () => {
    expect(modelUnits(plan)).toBeLessThan(170);
  });

  test("at each stop the camera stands inside its room, looking where its view looks", () => {
    stops.forEach(({ floor, room, view }, i) => {
      const state = modelAt(stopProgress(i, plan), plan);
      expect(state).toMatchObject({ phase: "tour", stop: i });
      const { position, target } = state.camera;
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

  test("holds still at a stop for a while", () => {
    const at = stopProgress(2, plan);
    expect(modelAt(at - 0.002, plan).camera).toEqual(modelAt(at + 0.002, plan).camera);
  });

  test("scroll outside the stretch keeps the first or the last state", () => {
    expect(modelAt(-0.5, plan)).toEqual(modelAt(0, plan));
    expect(modelAt(1.5, plan)).toEqual(modelAt(1, plan));
  });
});

describe("with reduced motion", () => {
  test("goes straight to each phase's destination: the sheet, the walls up, the landing", () => {
    const still = (p: number) => modelAt(p, plan, { still: true });
    const lift = phaseBounds("lift", plan);
    const descent = phaseBounds("descent", plan);
    expect(still(phaseBounds("sheet", plan).end / 2)).toEqual(modelAt(0, plan));
    expect(still((lift.start + lift.end) / 2)).toEqual(still(lift.end - 0.0001));
    expect(still(descent.start)).toEqual(still(descent.end - 0.0001));
  });

  test("goes straight from stop to stop, each room it has reached in colour", () => {
    for (const p of samples(tour.start, tour.end - 1e-6, 300)) {
      const state = modelAt(p, plan, { still: true });
      expect(state.stop).not.toBeNull();
      expect(state.camera).toEqual(modelAt(stopProgress(state.stop!, plan), plan).camera);
      expect(state.rooms.every(({ reveal }) => reveal === 0 || reveal === 1)).toBe(true);
    }
  });
});
