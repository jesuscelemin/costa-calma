import type { HousePlan, Opening, PlanFloor, Rect, Room, SectionPlane, Side } from "./schema";

// A house type's plan as geometry and as a set of checks (ADR 0006). Pure functions: the model,
// the 2D plan and the lists of rooms all read the plan through here.

/** Below this, two lengths in metres are the same: the data is declared to the centimetre. */
const EPS = 1e-6;

const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.w - EPS && b.x < a.x + a.w - EPS && a.z < b.z + b.d - EPS && b.z < a.z + a.d - EPS;

/** The garden is the plot itself, under everything else on it: it overlaps by design. */
const isBackground = (room: Room) => room.kind === "garden";

/** A double height: part of the room below, open to this storey, with no floor of its own. */
const isVoid = (room: Room) => room.kind === "void";

/** What lies under a storey's rooms: the storey or roof directly below it, if any. */
function floorBelow(plan: HousePlan, floor: PlanFloor): PlanFloor | undefined {
  if (floor.kind === "plot") return undefined;
  const built = plan.floors.filter(({ kind }) => kind !== "plot");
  return built[built.indexOf(floor) - 1];
}

/** The ground storey: the first one above the plot. */
const groundOf = (plan: HousePlan) => plan.floors.find(({ kind }) => kind === "storey");

function overlapIssues(floor: PlanFloor) {
  const rooms = floor.rooms.filter((room) => !isBackground(room));
  return rooms.flatMap((a, i) =>
    rooms
      .slice(i + 1)
      .filter((b) => overlaps(a, b))
      .map((b) => `${floor.name}: "${a.id}" and "${b.id}" overlap`),
  );
}

const overlapArea = (a: Rect, b: Rect) =>
  Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) *
  Math.max(0, Math.min(a.z + a.d, b.z + b.d) - Math.max(a.z, b.z));

const contains = (outer: Rect, inner: Rect) =>
  inner.x >= outer.x - EPS &&
  inner.z >= outer.z - EPS &&
  inner.x + inner.w <= outer.x + outer.w + EPS &&
  inner.z + inner.d <= outer.z + outer.d + EPS;

/** m² rounded to the centimetre squared, so sums of declared lengths compare exactly. */
const round = (m2: number) => Math.round(m2 * 100) / 100;

const rectArea = ({ w, d }: Rect) => round(w * d);

/** The m² of a room's rectangle that stands over the rooms of another floor. */
const supportedArea = (room: Rect, rooms: Rect[]) =>
  round(rooms.reduce((sum, below) => sum + overlapArea(room, below), 0));

const DOUBLE_HEIGHT_OVER: Room["kind"][] = ["living", "dining", "hall"];

function boundsIssues(plan: HousePlan, floor: PlanFloor) {
  const ground = groundOf(plan);
  if (floor.kind === "plot") {
    return floor.rooms
      .filter((room) => !isBackground(room))
      .flatMap((room) => [
        ...(contains(plan.plot, room) ? [] : [`${floor.name}: "${room.id}" lies outside the plot`]),
        ...(ground?.rooms.some((built) => overlaps(built, room))
          ? [`${floor.name}: "${room.id}" lies under the house`]
          : []),
      ]);
  }
  const outside = floor.rooms
    .filter((room) => !contains(plan.plot, room))
    .map((room) => `${floor.name}: "${room.id}" lies outside the plot`);
  const below = floorBelow(plan, floor);
  const support = floor.rooms.flatMap((room) => {
    if (isVoid(room)) {
      const under = below?.rooms.find((other) => contains(other, room));
      return under && DOUBLE_HEIGHT_OVER.includes(under.kind)
        ? []
        : [
            `${floor.name}: the double height "${room.id}" is not over a living room, dining room or hall`,
          ];
    }
    if (!below) return [];
    const supported = supportedArea(room, below.rooms);
    // A storey may overhang the one below; a roof terrace stands on it whole.
    if (floor.kind === "roof" && supported < rectArea(room)) {
      return [`${floor.name}: "${room.id}" does not stand on "${below.name}"`];
    }
    return supported > 0 ? [] : [`${floor.name}: "${room.id}" stands on nothing`];
  });
  return [...outside, ...support];
}

function canopyIssues(plan: HousePlan, floor: PlanFloor) {
  return (floor.canopies ?? [])
    .filter((canopy) => !contains(plan.plot, canopy))
    .map(({ kind }) => `${floor.name}: a ${kind} lies outside the plot`);
}

/**
 * A wall line: horizontal (a north or south side, at z = `line`, running along x) or vertical (an
 * east or west side, at x = `line`, running along z), from `a` to `b`.
 */
type Line = { axis: "x" | "z"; line: number; a: number; b: number };

function sideLine(room: Rect, side: Side): Line {
  switch (side) {
    case "north":
      return { axis: "x", line: room.z, a: room.x, b: room.x + room.w };
    case "south":
      return { axis: "x", line: room.z + room.d, a: room.x, b: room.x + room.w };
    case "west":
      return { axis: "z", line: room.x, a: room.z, b: room.z + room.d };
    case "east":
      return { axis: "z", line: room.x + room.w, a: room.z, b: room.z + room.d };
  }
}

const opposite: Record<Side, Side> = { north: "south", south: "north", east: "west", west: "east" };

/** What lies across a stretch of a room's side, piece by piece: another room, or the outside. */
function across(floor: PlanFloor, room: Room, side: Side, a: number, b: number) {
  const { line } = sideLine(room, side);
  const neighbours = floor.rooms
    .filter((other) => other !== room && !isBackground(other))
    .map((other) => ({ other, edge: sideLine(other, opposite[side]) }))
    .filter(({ edge }) => Math.abs(edge.line - line) < EPS && edge.a < b - EPS && edge.b > a + EPS)
    .map(({ other, edge }) => ({ a: Math.max(a, edge.a), b: Math.min(b, edge.b), room: other }))
    .sort((p, q) => p.a - q.a);

  const pieces: { a: number; b: number; room: Room | null }[] = [];
  let cursor = a;
  for (const piece of neighbours) {
    if (piece.a > cursor + EPS) pieces.push({ a: cursor, b: piece.a, room: null });
    pieces.push(piece);
    cursor = piece.b;
  }
  if (b > cursor + EPS) pieces.push({ a: cursor, b, room: null });
  return pieces;
}

/** Open-air rooms have no walls of their own: a wall stands only where an enclosed room ends. */
const hasWall = (room: Room, neighbour: Room | null) =>
  !room.open || (neighbour !== null && !neighbour.open);

const roomOf = (floor: PlanFloor, id: string) => floor.rooms.find((room) => room.id === id);

const describeOpening = ({ kind, room, at }: Opening) => `the ${kind} of "${room}" at ${at}`;

/** An opening's place: its line and the stretch of it that it takes. */
const openingLine = (room: Room, { side, at, width }: Opening): Line => ({
  ...sideLine(room, side),
  a: at - width / 2,
  b: at + width / 2,
});

function openingIssue(floor: PlanFloor, opening: Opening): string | undefined {
  const room = roomOf(floor, opening.room);
  if (!room) return `an opening names "${opening.room}", which is not a room of the floor`;

  const wall = sideLine(room, opening.side);
  const { a, b } = openingLine(room, opening);
  if (a < wall.a - EPS || b > wall.b + EPS) {
    return `${describeOpening(opening)} does not fit on its ${opening.side} wall`;
  }
  if ("hinge" in opening) {
    const ends: Side[] = wall.axis === "x" ? ["west", "east"] : ["north", "south"];
    if (!ends.includes(opening.hinge)) {
      return `${describeOpening(opening)} hangs from its ${opening.hinge} end, which ${
        opening.side === "east" ? "an" : "a"
      } ${opening.side} wall does not have`;
    }
  }
  const pieces = across(floor, room, opening.side, a, b);
  if (pieces.length > 1) return `${describeOpening(opening)} spans more than one wall`;

  const neighbour = pieces[0]?.room ?? null;
  if (!hasWall(room, neighbour)) return `${describeOpening(opening)} has no wall to sit in`;
  if (opening.kind !== "window" && (isVoid(room) || (neighbour && isVoid(neighbour)))) {
    return `${describeOpening(opening)} opens onto a double height, which has no floor`;
  }
  const joinsRooms = opening.kind === "door" || opening.kind === "passage";
  if (joinsRooms && neighbour === null) {
    return `${describeOpening(opening)} leads outside, but it has to join two rooms`;
  }
  if (!joinsRooms && neighbour !== null && !neighbour.open) {
    return `${describeOpening(opening)} is not on an outer wall`;
  }
}

function openingIssues(floor: PlanFloor) {
  const placed = floor.openings.flatMap((opening) => {
    const room = roomOf(floor, opening.room);
    return room ? [{ opening, line: openingLine(room, opening) }] : [];
  });
  const overlapping = placed.flatMap((p, i) =>
    placed
      .slice(i + 1)
      .filter(
        (q) =>
          p.line.axis === q.line.axis &&
          Math.abs(p.line.line - q.line.line) < EPS &&
          p.line.a < q.line.b - EPS &&
          q.line.a < p.line.b - EPS,
      )
      .map((q) => `${describeOpening(p.opening)} and ${describeOpening(q.opening)} overlap`),
  );
  return [
    ...floor.openings.flatMap((opening) => openingIssue(floor, opening) ?? []),
    ...overlapping,
  ].map((issue) => `${floor.name}: ${issue}`);
}

const SIDES: Side[] = ["north", "south", "east", "west"];

/** Rooms one step away: through an opening, or open-air rooms that simply meet. */
function neighboursOf(floor: PlanFloor, room: Room): Room[] {
  const throughOpenings = floor.openings.flatMap((opening) => {
    const from = roomOf(floor, opening.room);
    if (!from) return [];
    const { a, b } = openingLine(from, opening);
    const other = across(floor, from, opening.side, a, b)[0]?.room;
    if (!other) return [];
    if (from === room) return [other];
    return other === room ? [from] : [];
  });
  const meeting = room.open
    ? SIDES.flatMap((side) => {
        const { a, b } = sideLine(room, side);
        return across(floor, room, side, a, b).flatMap(({ room: other }) =>
          other?.open ? [other] : [],
        );
      })
    : [];
  return [...throughOpenings, ...meeting];
}

function accessIssues(plan: HousePlan, floor: PlanFloor) {
  if (floor.kind === "plot") return [];
  const isGround = plan.floors.find(({ kind }) => kind === "storey") === floor;
  const start = isGround
    ? floor.openings
        .filter(({ kind }) => kind === "entrance")
        .map((opening) => roomOf(floor, opening.room))[0]
    : floor.rooms.find(({ kind }) => kind === "stair");
  if (!start) {
    return [`${floor.name}: it has no ${isGround ? "front door" : "stair to arrive by"}`];
  }

  const reached = new Set([start]);
  const queue = [start];
  for (let room = queue.shift(); room; room = queue.shift()) {
    for (const next of neighboursOf(floor, room)) {
      if (reached.has(next)) continue;
      reached.add(next);
      queue.push(next);
    }
  }
  return floor.rooms
    .filter((room) => !reached.has(room) && !isVoid(room))
    .map((room) => `${floor.name}: "${room.id}" cannot be reached from "${start.id}"`);
}

const sameRect = (a: Rect, b: Rect) =>
  Math.abs(a.x - b.x) < EPS &&
  Math.abs(a.z - b.z) < EPS &&
  Math.abs(a.w - b.w) < EPS &&
  Math.abs(a.d - b.d) < EPS;

/** The stair climbs through one well: where the first floor with a stair has it, all have it. */
function stairIssues(plan: HousePlan) {
  const withStair = plan.floors.flatMap((floor) => {
    const stair = floor.rooms.find(({ kind }) => kind === "stair");
    return stair ? [{ floor, stair, entry: stairEntry(floor) }] : [];
  });
  const [first, ...rest] = withStair;
  if (!first) return [];
  return rest.flatMap(({ floor, stair, entry }) => {
    if (!sameRect(stair, first.stair)) {
      return [`${floor.name}: the stair is not where it is on "${first.floor.name}"`];
    }
    // A U-shaped stair leaves and arrives at the same end: entered from the other one, its flights
    // would cross each other.
    if (entry && first.entry && entry !== first.entry) {
      return [
        `${floor.name}: the stair is entered from its ${entry} end, not its ${first.entry} end as on "${first.floor.name}"`,
      ];
    }
    return [];
  });
}

/**
 * The end of its floor's stair where people step on and off it, along its long side: where its
 * openings are. Undefined without a stair or an opening onto it.
 */
export function stairEntry(floor: PlanFloor): Side | undefined {
  const stair = floor.rooms.find(({ kind }) => kind === "stair");
  if (!stair) return undefined;
  const alongZ = stair.d >= stair.w;
  for (const opening of floor.openings) {
    const from = roomOf(floor, opening.room);
    if (!from) continue;
    const line = openingLine(from, opening);
    const onto =
      from === stair || across(floor, from, opening.side, line.a, line.b)[0]?.room === stair;
    if (!onto) continue;
    const centre = (line.a + line.b) / 2;
    const [x, z] = line.axis === "x" ? [centre, line.line] : [line.line, centre];
    return alongZ
      ? z < stair.z + stair.d / 2
        ? "north"
        : "south"
      : x < stair.x + stair.w / 2
        ? "west"
        : "east";
  }
  return undefined;
}

/** The m² a room takes: its rectangle, or for the garden, what the plot leaves. */
function takenArea(plan: HousePlan, floor: PlanFloor, room: Room) {
  if (!isBackground(room)) return rectArea(room);
  const others = floor.rooms.filter((other) => other !== room);
  const house = groundOf(plan)?.rooms ?? [];
  return round(
    rectArea(room) - [...house, ...others].reduce((sum, other) => sum + rectArea(other), 0),
  );
}

function areaIssues(plan: HousePlan, floor: PlanFloor) {
  return floor.rooms.flatMap((room) => {
    const taken = takenArea(plan, floor, room);
    return room.area === undefined || room.area === taken
      ? []
      : [`${floor.name}: "${room.id}" declares ${room.area} m² but takes ${taken} m²`];
  });
}

/** The party wall's line: the plot's edge it names, if the house is half of a pair. */
const partyLine = ({ plot, partyWall }: Pick<HousePlan, "plot" | "partyWall">) =>
  partyWall ? sideLine(plot, partyWall) : undefined;

/** The wall shared with the neighbour stands on the plot's edge and is blind on every floor. */
function partyWallIssues(plan: HousePlan) {
  const party = partyLine(plan);
  if (!party || !plan.partyWall) return [];
  const side = plan.partyWall;
  const onEdge = (groundOf(plan)?.rooms ?? []).some(
    (room) => Math.abs(sideLine(room, side).line - party.line) < EPS,
  );
  const openings = plan.floors.flatMap((floor) =>
    floor.openings.flatMap((opening) => {
      const room = roomOf(floor, opening.room);
      if (!room) return [];
      const line = openingLine(room, opening);
      const inWall =
        line.axis === party.axis &&
        Math.abs(line.line - party.line) < EPS &&
        line.a < party.b - EPS &&
        line.b > party.a + EPS;
      return inWall ? [`${floor.name}: ${describeOpening(opening)} is in the party wall`] : [];
    }),
  );
  return [
    ...(onEdge ? [] : [`The ground floor does not reach the plot's ${side} edge, its party wall`]),
    ...openings,
  ];
}

function wardrobeIssues(floor: PlanFloor) {
  return floor.rooms
    .filter((room) => room.wardrobe && !contains(room, room.wardrobe))
    .map((room) => `${floor.name}: the wardrobe of "${room.id}" lies outside it`);
}

/**
 * The stretch of a rectangle that a section's plane cuts through, along the plane: z from north to
 * south on a north–south section, x from west to east on an east–west one. Undefined if the plane
 * misses it, or only runs along its edge.
 */
export function sectionCut(rect: Rect, { runs, at }: SectionPlane) {
  const [start, size, from, length] =
    runs === "north-south" ? [rect.x, rect.w, rect.z, rect.d] : [rect.z, rect.d, rect.x, rect.w];
  if (at <= start + EPS || at >= start + size - EPS) return undefined;
  return { from, to: mm(from + length) };
}

/** The section, if declared, cuts through a room of every storey and of the roof. */
function sectionIssues({ section, floors }: HousePlan) {
  if (!section) return [];
  const axis = section.runs === "north-south" ? "x" : "z";
  return floors
    .filter(({ kind }) => kind !== "plot")
    .filter(({ rooms }) => !rooms.some((room) => sectionCut(room, section)))
    .map(({ name }) => `The section at ${axis} = ${section.at} does not cut through ${name}`);
}

/** What is wrong with a plan, one message per problem; empty when it is coherent. */
export function validatePlan(plan: HousePlan): string[] {
  return plan.floors
    .flatMap((floor) => [
      ...overlapIssues(floor),
      ...boundsIssues(plan, floor),
      ...openingIssues(floor),
      ...accessIssues(plan, floor),
      ...areaIssues(plan, floor),
      ...wardrobeIssues(floor),
      ...canopyIssues(plan, floor),
    ])
    .concat(stairIssues(plan), partyWallIssues(plan), sectionIssues(plan));
}

/** The key figures a house type presents, counted from its plan so they never disagree with it. */
export function planFigures(plan: HousePlan) {
  const storeys = plan.floors.filter(({ kind }) => kind === "storey");
  const count = (kind: Room["kind"]) =>
    storeys.reduce(
      (sum, floor) => sum + floor.rooms.filter((room) => room.kind === kind).length,
      0,
    );
  return {
    // Enclosed rooms only, to the whole m², as a listing gives it.
    builtArea: Math.round(
      storeys
        .flatMap(({ rooms }) => rooms.filter((room) => !room.open && !isVoid(room)))
        .reduce((sum, room) => sum + rectArea(room), 0),
    ),
    plotArea: rectArea(plan.plot),
    bedrooms: count("bedroom"),
    bathrooms: count("bath"),
    toilets: count("toilet"),
  };
}

export type Point = { x: number; z: number };

/** A party wall is the outer wall shared with the neighbour of a semi-detached pair. */
export type WallKind = "exterior" | "interior" | "railing" | "party";

/** A straight piece of wall, from (x1, z1) to (x2, z2). */
export type WallSegment = { x1: number; z1: number; x2: number; z2: number; kind: WallKind };

export type OpeningGeometry = {
  kind: Opening["kind"];
  /** The room it was declared from. */
  room: string;
  /** The gap it leaves in its wall. */
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  /** Windows: the sill's height, in metres. */
  sill?: number;
  /**
   * Swinging doors: the leaf, open a quarter turn, from the hinge to `leaf`; its arc runs from
   * `leaf` back to the gap's other end, clockwise as x turns towards z (as SVG draws it).
   */
  swing?: { hinge: Point; leaf: Point; clockwise: boolean };
};

export type RoomGeometry = Room & { area: number };

export type FloorGeometry = {
  rooms: RoomGeometry[];
  walls: WallSegment[];
  openings: OpeningGeometry[];
};

/** Coordinates to the millimetre, so sums like 1 − 0,45 come out as declared. */
const mm = (metres: number) => Math.round(metres * 1000) / 1000;

const outward: Record<Side, Point> = {
  north: { x: 0, z: -1 },
  south: { x: 0, z: 1 },
  west: { x: -1, z: 0 },
  east: { x: 1, z: 0 },
};

const at = ({ axis, line }: Line, along: number): Point =>
  axis === "x" ? { x: mm(along), z: mm(line) } : { x: mm(line), z: mm(along) };

const segment = (line: Line, a: number, b: number) => {
  const [start, end] = [at(line, a), at(line, b)];
  return { x1: start.x, z1: start.z, x2: end.x, z2: end.z };
};

function swingOf(room: Room, opening: Extract<Opening, { opens: unknown }>) {
  const line = openingLine(room, opening);
  const hingeAtStart = opening.hinge === (line.axis === "x" ? "west" : "north");
  const [hingeAlong, freeAlong] = hingeAtStart ? [line.a, line.b] : [line.b, line.a];
  const hinge = at(line, hingeAlong);
  const free = at(line, freeAlong);
  const sign = opening.opens === "out" ? 1 : -1;
  const normal = outward[opening.side];
  const leaf = {
    x: mm(hinge.x + sign * normal.x * opening.width),
    z: mm(hinge.z + sign * normal.z * opening.width),
  };
  const cross = (leaf.x - hinge.x) * (free.z - hinge.z) - (leaf.z - hinge.z) * (free.x - hinge.x);
  return { hinge, leaf, clockwise: cross > 0 };
}

/** The rooms that look over a double height through a railing. */
const OVERLOOKS: Room["kind"][] = ["corridor", "hall", "study"];

/** Removes the openings' stretches from a piece of wall. */
function cut(a: number, b: number, gaps: { a: number; b: number }[]) {
  const pieces: [number, number][] = [];
  let cursor = a;
  for (const gap of [...gaps].sort((p, q) => p.a - q.a)) {
    if (gap.b <= cursor + EPS || gap.a >= b - EPS) continue;
    if (gap.a > cursor + EPS) pieces.push([cursor, gap.a]);
    cursor = Math.max(cursor, gap.b);
  }
  if (b > cursor + EPS) pieces.push([cursor, b]);
  return pieces;
}

/** The walls along one side of a room, with the openings on that line cut out of them. */
function wallsOfSide(
  floor: PlanFloor,
  index: number,
  side: Side,
  gaps: Line[],
  party: Line | undefined,
): WallSegment[] {
  const room = floor.rooms[index]!;
  const line = sideLine(room, side);
  const onParty = party && party.axis === line.axis && Math.abs(party.line - line.line) < EPS;
  const onLine = gaps.filter(
    (gap) => gap.axis === line.axis && Math.abs(gap.line - line.line) < EPS,
  );
  return across(floor, room, side, line.a, line.b).flatMap(({ a, b, room: other }) => {
    // A wall shared by two rooms is drawn once, from the first of them.
    if (other && floor.rooms.indexOf(other) < index) return [];
    let kind: WallKind;
    if (!hasWall(room, other)) {
      if (other !== null) return [];
      kind = "railing";
    } else if (other && !other.open && !room.open) {
      // Where a double height meets a corridor, a hall or a study, a railing stands instead of a
      // wall; a bedroom or a bathroom keeps its wall.
      const overlooking = isVoid(room) ? other : isVoid(other) ? room : undefined;
      kind = overlooking && OVERLOOKS.includes(overlooking.kind) ? "railing" : "interior";
    } else {
      kind = onParty ? "party" : "exterior";
    }
    return cut(a, b, onLine).map(([p, q]) => ({ ...segment(line, p, q), kind }));
  });
}

/**
 * A floor as something to draw or build: its rooms with their m², its walls with every opening cut
 * out of them, and the openings themselves. The plot has no walls: the house's are the ground
 * floor's. The outer walls on its plan's party wall, if any, are party walls.
 */
export function floorGeometry(
  floor: PlanFloor,
  plan: Pick<HousePlan, "plot" | "partyWall">,
): FloorGeometry {
  const rooms = floor.rooms.map((room) => ({ ...room, area: room.area ?? rectArea(room) }));

  const openings = floor.openings.flatMap((opening): OpeningGeometry[] => {
    const room = roomOf(floor, opening.room);
    if (!room) return [];
    const line = openingLine(room, opening);
    return [
      {
        kind: opening.kind,
        room: opening.room,
        ...segment(line, line.a, line.b),
        ...(opening.kind === "window" && { sill: opening.sill }),
        ...("opens" in opening && { swing: swingOf(room, opening) }),
      },
    ];
  });
  const gaps = floor.openings.flatMap((opening) => {
    const room = roomOf(floor, opening.room);
    return room ? [openingLine(room, opening)] : [];
  });

  const party = partyLine(plan);
  const walls =
    floor.kind === "plot"
      ? []
      : floor.rooms.flatMap((room, index) =>
          SIDES.flatMap((side) => wallsOfSide(floor, index, side, gaps, party)),
        );

  return { rooms, walls, openings };
}

/** The m² of a floor's rooms, together; a double height has none of its own. */
export function floorArea(floor: PlanFloor) {
  return round(
    floor.rooms
      .filter((room) => !isVoid(room))
      .reduce((sum, room) => sum + (room.area ?? rectArea(room)), 0),
  );
}

/** Whether any of these rooms reaches past the rooms below them: an overhang. */
export function overhangs(rooms: Rect[], below: Rect[]) {
  return rooms.some((room) => supportedArea(room, below) < rectArea(room));
}

/** The rectangle that holds every storey, roof and shade: what a floor's plan frames. */
export function houseBounds(plan: HousePlan): Rect {
  const rooms = plan.floors
    .filter(({ kind }) => kind !== "plot")
    .flatMap(({ rooms, canopies }) => [...rooms, ...(canopies ?? [])]);
  const x = Math.min(...rooms.map((room) => room.x));
  const z = Math.min(...rooms.map((room) => room.z));
  const w = mm(Math.max(...rooms.map((room) => room.x + room.w)) - x);
  const d = mm(Math.max(...rooms.map((room) => room.z + room.d)) - z);
  return { x, z, w, d };
}
