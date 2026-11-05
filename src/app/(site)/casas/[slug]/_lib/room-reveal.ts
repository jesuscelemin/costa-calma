import type { HousePlan, PlanFloor, Room } from "@/features/houses/schema";

import { SLAB_DEPTH, STOREY_HEIGHT, WALL_HEIGHT } from "./model-geometry";
import { floorLevel, type Vec3 } from "./tour";

// The rooms the sweep turns into colour one by one (ADR 0010), as the materials look them up: each
// point of the house takes the state of the first room whose box holds it. The storeys' rooms come
// first, then the plot's from the smallest up, and last the garden, which holds everything else,
// the plot and beyond. Pure, from the plan.

/** The axis a room's sweep runs along: the way the camera came in. */
export type SweepAxis = "+x" | "-x" | "+z" | "-z";

export type RevealRoom = {
  /** `floor/room`. */
  key: string;
  floor: PlanFloor;
  room: Room;
  /** What the materials look a point up in: the room's rectangle and the heights it spans. */
  box: { x0: number; z0: number; x1: number; z1: number; y0: number; y1: number };
  /** Whether the camera can stand in it: not a double height, which has no floor. */
  walkable: boolean;
  /** A double height takes the state of the room under it: that room's index. */
  under?: number;
};

/** How far above and below everything the plot's rooms reach, and how far out the garden. */
const FAR = 1000;
const EPS = 1e-6;

const overlaps = (a: Room, b: Room) =>
  a.x < b.x + b.w - EPS && b.x < a.x + a.w - EPS && a.z < b.z + b.d - EPS && b.z < a.z + a.d - EPS;

const known = new WeakMap<HousePlan, RevealRoom[]>();

/** The plan's rooms, in the order the materials look them up. Worked out once for each plan. */
export function revealRooms(plan: HousePlan): RevealRoom[] {
  const cached = known.get(plan);
  if (cached) return cached;
  const storeys = plan.floors.filter(({ kind }) => kind !== "plot");
  const plot = plan.floors.find(({ kind }) => kind === "plot");
  const rooms: RevealRoom[] = [];
  storeys.forEach((floor, index) => {
    const level = floorLevel(plan, floor.id);
    // From under its own slab to under the next one's; the top storey reaches the sky.
    const y0 = level - SLAB_DEPTH;
    const y1 = index === storeys.length - 1 ? FAR : level + WALL_HEIGHT;
    for (const room of floor.rooms) {
      rooms.push({
        key: `${floor.id}/${room.id}`,
        floor,
        room,
        box: { x0: room.x, z0: room.z, x1: room.x + room.w, z1: room.z + room.d, y0, y1 },
        walkable: room.kind !== "void",
      });
    }
  });
  // A double height is the room under it, a storey up.
  for (const entry of rooms) {
    if (entry.walkable) continue;
    const below = storeys[storeys.indexOf(entry.floor) - 1];
    const under = rooms.findIndex(
      (other) => other.floor === below && other.walkable && overlaps(other.room, entry.room),
    );
    if (under >= 0) entry.under = under;
  }
  const outside = [...(plot?.rooms ?? [])].sort((a, b) => {
    const garden = (room: Room) => (room.kind === "garden" ? 1 : 0);
    return garden(a) - garden(b) || a.w * a.d - b.w * b.d;
  });
  for (const room of outside) {
    const garden = room.kind === "garden";
    rooms.push({
      key: `${plot!.id}/${room.id}`,
      floor: plot!,
      room,
      box: garden
        ? { x0: -FAR, z0: -FAR, x1: FAR, z1: FAR, y0: -FAR, y1: FAR }
        : {
            x0: room.x,
            z0: room.z,
            x1: room.x + room.w,
            z1: room.z + room.d,
            y0: -FAR,
            y1: STOREY_HEIGHT,
          },
      walkable: true,
    });
  }
  known.set(plan, rooms);
  return rooms;
}

/** The index of the room a point is in, as the materials have it; -1 if none holds it. */
export function roomIndexAt(rooms: readonly RevealRoom[], { x, y, z }: Vec3) {
  return rooms.findIndex(
    ({ box }) =>
      x >= box.x0 && x < box.x1 && z >= box.z0 && z < box.z1 && y >= box.y0 && y < box.y1,
  );
}

/** The room the camera stands in: never a double height, which it can only look into. */
export function cameraRoomAt(rooms: readonly RevealRoom[], point: Vec3) {
  const index = roomIndexAt(rooms, point);
  if (index < 0 || rooms[index]!.walkable) return index;
  return rooms[index]!.under ?? -1;
}

/** The axis a step along a direction on the plan runs on, the larger of its two components. */
export function sweepAxis({ x, z }: { x: number; z: number }): SweepAxis {
  if (Math.abs(x) > Math.abs(z)) return x > 0 ? "+x" : "-x";
  return z >= 0 ? "+z" : "-z";
}

/** How wide the soft edge of a room's sweep is, in metres. */
export const ROOM_BAND = 1.5;

/** Where a room's real extent runs along its sweep's axis, from where it starts to where it ends. */
function extent(room: Room, axis: SweepAxis) {
  switch (axis) {
    case "+x":
      return [room.x, room.x + room.w] as const;
    case "-x":
      return [-(room.x + room.w), -room.x] as const;
    case "+z":
      return [room.z, room.z + room.d] as const;
    case "-z":
      return [-(room.z + room.d), -room.z] as const;
  }
}

/**
 * Where a room's sweep front stands along its axis, in metres, for how far it has gone (0–1):
 * before the room, so none of it has turned yet, up to past it, so all of it has.
 */
export function sweepFront(room: Room, axis: SweepAxis, reveal: number) {
  if (reveal <= 0) return -FAR * 10;
  if (reveal >= 1) return FAR * 10;
  const [from, to] = extent(room, axis);
  return from - ROOM_BAND + (to - from + ROOM_BAND * 2) * reveal;
}
