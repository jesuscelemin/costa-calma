import { describe, expect, test } from "vitest";

import { villaMarPlan } from "@/features/houses/fixtures/villa-mar";

import {
  floorView,
  modelAt,
  modelPhases,
  NO_CUT,
  phaseBounds,
  pickAt,
  SHEET_CUT,
  SHEET_FOV,
  modelUnits,
  stopAt,
  stopProgress,
  enterAt,
  walkActions,
  WALK_FOV,
  type ModelState,
} from "./model-choreography";
import { floorModel, STOREY_HEIGHT, WALL_HEIGHT, type Box } from "./model-geometry";
import { revealRooms, ROOM_BAND, sweepFront } from "./room-reveal";
import {
  builtFloors,
  canEnter,
  entranceOf,
  EYE_HEIGHT,
  floorLevel,
  roomViewpoint,
  tourStops,
  type Vec3,
} from "./tour";

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

  test("each stop's cartela comes on as the camera crosses into its room", () => {
    stops.forEach(({ floor, room }, i) => {
      const level = floorLevel(plan, floor.id);
      // After the stop before has come on, the first point inside the stop's room.
      const before = i === 0 ? 0 : walk.findIndex((state) => state.stop === i - 1);
      const into = walk.findIndex(
        ({ camera: { position: p } }, at) =>
          at > before &&
          p.x >= room.x &&
          p.x < room.x + room.w &&
          p.z >= room.z &&
          p.z < room.z + room.d &&
          p.y >= level &&
          p.y < level + WALL_HEIGHT,
      );
      const first = walk.findIndex((state) => state.stop === i);
      // Within a few centimetres of the threshold: never metres later.
      expect(first - into, room.id).toBeLessThanOrEqual(2);
      expect(first, room.id).toBeGreaterThanOrEqual(into);
    });
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
    // The hall's front, along its way in from the door (+z), against its threshold.
    const hall = rooms.findIndex(({ key }) => key === "ground/recibidor");
    const front = (state: ModelState) =>
      sweepFront(rooms[hall]!.room, state.rooms[hall]!.axis, state.rooms[hall]!.reveal);
    const threshold = rooms[hall]!.room.z;
    // A step short of the door, none of the hall is in colour yet.
    const outside = walk.filter(({ camera }) => camera.position.z < threshold - 0.6);
    for (const state of outside) expect(front(state)).toBeLessThanOrEqual(threshold);
    // Crossing it, its threshold is in colour, and the front has run on ahead.
    const crossing = walk.find(({ camera }) => camera.position.z >= threshold)!;
    expect(front(crossing) - ROOM_BAND).toBeGreaterThanOrEqual(threshold - 1e-6);
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

describe("the whole house and its floors", () => {
  const whole = modelAt(1, plan);
  const storeys = plan.floors.filter(({ kind }) => kind !== "plot");
  const exterior = plan.floors.find(({ kind }) => kind === "plot")!;
  const roomsOf = (state: ModelState, floorId: string) =>
    state.rooms.filter((_, i) => rooms[i]!.floor.id === floorId);
  const pose = (state: ModelState, floorId: string) =>
    state.floors.find(({ id }) => id === floorId)!;
  const ts = samples(0, 1, 200);
  /** A screen whose whole is the plan's area. */
  const centred = { aspect: 16 / 10, area: { x: 0, y: 0, width: 1, height: 1 } };

  test("at the end of the scroll, the whole house: no floor picked, every floor in its place", () => {
    expect(whole.phase).toBe("finale");
    expect(whole.floor).toBeNull();
    expect(whole.floors.map(({ id }) => id)).toEqual(plan.floors.map(({ id }) => id));
    for (const floor of whole.floors) {
      expect(floor).toMatchObject({ lift: 0, opacity: 1, plan: 0 });
    }
  });

  test("a floor picked: the ones above out of the way, the camera over it, cut at half height", () => {
    storeys.forEach((floor, index) => {
      const state = floorView(plan, floor.id, { screen: centred });
      expect(state).toMatchObject({ phase: "floor", floor: floor.id, stop: null });
      storeys.forEach((other, i) => {
        const { lift, opacity } = pose(state, other.id);
        if (i > index) {
          expect(lift, other.id).toBeGreaterThan(2);
          expect(opacity, other.id).toBe(0);
        } else expect({ lift, opacity }, other.id).toEqual({ lift: 0, opacity: 1 });
      });
      const level = floorLevel(plan, floor.id);
      expect(state.cut).toBeCloseTo(level + WALL_HEIGHT / 2, 5);
      // Almost straight down, at the middle of the floor's rooms.
      const { position, target } = state.camera;
      expect(towards(position, target).y, floor.id).toBeLessThan(-0.95);
      const built = floor.rooms.filter(({ kind }) => (kind as string) !== "void");
      const x0 = Math.min(...built.map(({ x }) => x));
      const x1 = Math.max(...built.map(({ x, w }) => x + w));
      const z0 = Math.min(...built.map(({ z }) => z));
      const z1 = Math.max(...built.map(({ z, d }) => z + d));
      expect(target.x, floor.id).toBeCloseTo((x0 + x1) / 2, 5);
      expect(target.z, floor.id).toBeCloseTo((z0 + z1) / 2, 5);
      expect(target.y, floor.id).toBeCloseTo(level, 5);
      // Its rooms in colour, its plan's axes and dimensions round them.
      expect(roomsOf(state, floor.id).every(({ reveal }) => reveal === 1)).toBe(true);
      expect(pose(state, floor.id).plan).toBe(1);
    });
  });

  test("Exterior: the house whole over the plot, from straight above, the plot in colour", () => {
    const state = floorView(plan, exterior.id, { screen: centred });
    expect(state.floor).toBe(exterior.id);
    expect(state.cut).toBe(NO_CUT);
    for (const floor of state.floors) expect(floor).toMatchObject({ lift: 0, opacity: 1 });
    const { position, target } = state.camera;
    expect(towards(position, target).y).toBeLessThan(-0.95);
    expect(target.x).toBeCloseTo(plan.plot.x + plan.plot.w / 2, 5);
    expect(target.z).toBeCloseTo(plan.plot.z + plan.plot.d / 2, 5);
    expect(state.rooms.every(({ reveal }) => reveal === 1)).toBe(true);
  });

  test("picking a floor: from where the camera is, the floor drawn first, then swept into 3D", () => {
    const [ground, first] = storeys;
    const picked = (t: number) => pickAt(plan, { from: whole, floor: first!.id, whole, t });
    expect(picked(0).camera).toEqual(whole.camera);
    // There is a moment it is all drawing: its rooms ink, its axes and dimensions round them.
    const drawn = ts.map(picked).filter((state) => {
      return (
        roomsOf(state, first!.id).every(({ reveal }) => reveal === 0) &&
        pose(state, first!.id).plan === 1
      );
    });
    expect(drawn.length).toBeGreaterThan(10);
    // The floor below keeps its colour throughout.
    for (const state of ts.map(picked)) {
      expect(roomsOf(state, ground!.id).every(({ reveal }) => reveal === 1)).toBe(true);
    }
    expect(picked(1)).toEqual(floorView(plan, first!.id));
    // On the way, smoothly: the camera never jumps.
    const states = ts.map(picked);
    for (let i = 1; i < states.length; i++) {
      const [a, b] = [states[i - 1]!.camera.position, states[i]!.camera.position];
      expect(length({ x: b.x - a.x, y: b.y - a.y, z: b.z - a.z })).toBeLessThan(2);
    }
  });

  test("from one floor to another, and back to the whole house, without a jump", () => {
    const [ground, first] = storeys;
    const from = floorView(plan, ground!.id);
    const to = (t: number) => pickAt(plan, { from, floor: first!.id, whole, t });
    expect(to(0).camera).toEqual(from.camera);
    expect(to(1)).toEqual(floorView(plan, first!.id));
    const back = (t: number) =>
      pickAt(plan, { from: floorView(plan, first!.id), floor: null, whole, t });
    expect(back(0).camera).toEqual(floorView(plan, first!.id).camera);
    expect(back(1)).toEqual(whole);
    // Halfway back, the floors above coming down and in again.
    const halfway = pose(back(0.5), storeys[2]!.id);
    expect(halfway.opacity).toBeGreaterThan(0);
    expect(halfway.opacity).toBeLessThan(1);
  });

  test("with reduced motion, straight to where it goes", () => {
    const [, first] = storeys;
    for (const t of [0, 0.3, 0.7]) {
      expect(pickAt(plan, { from: whole, floor: first!.id, whole, t }, { still: true })).toEqual(
        floorView(plan, first!.id),
      );
      expect(
        pickAt(plan, { from: floorView(plan, first!.id), floor: null, whole, t }, { still: true }),
      ).toEqual(whole);
    }
  });
});

describe("entering a room of a picked floor", () => {
  /** Every room that can be entered: all but the garden, which is the plot round the house. */
  const enterable = plan.floors.flatMap((floor) =>
    floor.rooms.filter(canEnter).map((room) => ({ floor, room })),
  );
  const inside = (floor: string, room: string) =>
    enterAt(plan, { floor, room, from: 0, to: 1, t: 1 });

  test("Villa Mar has 26 rooms to enter", () => {
    expect(enterable).toHaveLength(26);
  });

  test("inside, the camera stands at eye height within the room, looking at its viewpoint's target", () => {
    for (const { floor, room } of enterable) {
      const where = `${floor.id}/${room.id}`;
      const state = inside(floor.id, room.id);
      expect(state, where).toMatchObject({
        phase: "room",
        floor: floor.id,
        room: room.id,
        stop: null,
      });
      const { position, target } = state.camera;
      expect(position.y, where).toBeCloseTo(floorLevel(plan, floor.id) + EYE_HEIGHT, 5);
      expect(position.x, where).toBeGreaterThan(room.x);
      expect(position.x, where).toBeLessThan(room.x + room.w);
      expect(position.z, where).toBeGreaterThan(room.z);
      expect(position.z, where).toBeLessThan(room.z + room.d);
      // The tour's rooms have their stop's view, below.
      if (stops.some((stop) => stop.room === room)) continue;
      const view = roomViewpoint(plan, floor, room);
      expect(towards(position, target), where).toEqual(towards(view.from, view.to));
    }
  });

  test("a room the tour stops at is seen from its stop's view", () => {
    for (const stop of stops) {
      const { camera } = inside(stop.floor.id, stop.room.id);
      expect(camera.position, stop.room.id).toEqual(stop.view.from);
      expect(camera.target, stop.room.id).toEqual(stop.view.to);
    }
  });

  test("on the way in, from over the floor down into the room, without a jump or going through a wall", () => {
    for (const { floor, room } of enterable) {
      const where = `${floor.id}/${room.id}`;
      const level = floorLevel(plan, floor.id);
      const states = samples(0, 1, 200).map((t) =>
        enterAt(plan, { floor: floor.id, room: room.id, from: 0, to: 1, t }),
      );
      expect(states[0]!.camera, where).toEqual(floorView(plan, floor.id).camera);
      for (let i = 1; i < states.length; i++) {
        const [a, b] = [states[i - 1]!.camera.position, states[i]!.camera.position];
        expect(length({ x: b.x - a.x, y: b.y - a.y, z: b.z - a.z }), where).toBeLessThan(1.5);
      }
      for (const state of states) {
        const { x, y, z } = state.camera.position;
        // Under the top of its walls, it is over the room.
        if (y < level + WALL_HEIGHT + 0.2) {
          expect(x, where).toBeGreaterThan(room.x);
          expect(x, where).toBeLessThan(room.x + room.w);
          expect(z, where).toBeGreaterThan(room.z);
          expect(z, where).toBeLessThan(room.z + room.d);
        }
        // The floors over it are out of the way while the camera comes down through them.
        builtFloors(plan).forEach((other) => {
          const above = floorLevel(plan, other.id);
          if (above <= level) return;
          const pose = state.floors.find(({ id }) => id === other.id)!;
          if (y > above - 0.2 && y < above + STOREY_HEIGHT + 1.5) {
            expect(pose.opacity, `${where} through ${other.id}`).toBe(0);
          }
        });
      }
    }
  });

  test("inside, the house is whole round it: every floor in place, uncut", () => {
    for (const { floor, room } of enterable) {
      const state = inside(floor.id, room.id);
      expect(state.cut).toBe(NO_CUT);
      for (const pose of state.floors) expect(pose).toMatchObject({ lift: 0, opacity: 1 });
    }
  });

  test("«Volver a la planta» leaves the floor picked, from inside or halfway in", () => {
    const out = (from: number, t: number) =>
      enterAt(plan, { floor: "first", room: "suite", from, to: 0, t });
    expect(out(1, 1)).toEqual(floorView(plan, "first"));
    expect(out(0.4, 1)).toEqual(floorView(plan, "first"));
    // Halfway out is where it was halfway in.
    expect(out(1, 0.5)).toEqual(
      enterAt(plan, { floor: "first", room: "suite", from: 0, to: 1, t: 0.5 }),
    );
  });

  test("with reduced motion, straight inside or back over the floor", () => {
    for (const t of [0, 0.3, 0.7]) {
      expect(
        enterAt(plan, { floor: "ground", room: "salon", from: 0, to: 1, t }, { still: true }),
      ).toEqual(inside("ground", "salon"));
      expect(
        enterAt(plan, { floor: "ground", room: "salon", from: 1, to: 0, t }, { still: true }),
      ).toEqual(floorView(plan, "ground"));
    }
  });
});
