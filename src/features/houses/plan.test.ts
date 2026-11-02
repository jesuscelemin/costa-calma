import { describe, expect, test } from "vitest";

import { floorGeometry, planFigures, stairEntry, validatePlan } from "./plan";
import { villaMarPlan } from "./plans/villa-mar";
import type { HousePlan, Opening, PlanFloor, Room } from "./schema";

// An invented one-storey house, 6 × 4 m on a 10 × 10 m plot: a hall with the front door to the
// north and a bedroom off it. Each test breaks one rule of it.
const room = (id: string, kind: Room["kind"], x: number, z: number, w: number, d: number) =>
  ({ id, name: id, kind, x, z, w, d, orientation: "Norte" }) satisfies Room;

const entrance: Opening = {
  kind: "entrance",
  room: "hall",
  side: "north",
  at: 1,
  width: 0.9,
  opens: "in",
  hinge: "east",
};
const bedroomDoor: Opening = {
  kind: "door",
  room: "hall",
  side: "east",
  at: 2,
  width: 0.8,
  opens: "out",
  hinge: "north",
};

const plotFloor: PlanFloor = {
  id: "plot",
  name: "Exterior",
  kind: "plot",
  rooms: [{ ...room("garden", "garden", -2, -2, 10, 10), open: true, area: 76 }],
  openings: [],
};

const ground: PlanFloor = {
  id: "ground",
  name: "Planta baja",
  kind: "storey",
  rooms: [room("hall", "hall", 0, 0, 2, 4), room("bedroom", "bedroom", 2, 0, 4, 4)],
  openings: [entrance, bedroomDoor],
};

const house: HousePlan = {
  plot: { x: -2, z: -2, w: 10, d: 10 },
  footprint: { x: 0, z: 0, w: 6, d: 4 },
  floors: [plotFloor, ground],
};

const withGround = (changes: Partial<PlanFloor>): HousePlan => ({
  ...house,
  floors: [plotFloor, { ...ground, ...changes }],
});

describe("validatePlan", () => {
  test("Villa Mar's plan is coherent", () => {
    expect(validatePlan(villaMarPlan)).toEqual([]);
  });

  test("the invented house is coherent too", () => {
    expect(validatePlan(house)).toEqual([]);
  });

  test("rooms do not overlap", () => {
    const rooms = [room("hall", "hall", 0, 0, 2.5, 4), room("bedroom", "bedroom", 2, 0, 4, 4)];
    expect(validatePlan(withGround({ rooms }))).toContain(
      'Planta baja: "hall" and "bedroom" overlap',
    );
  });

  test("a storey's rooms lie inside the footprint", () => {
    const rooms = [room("hall", "hall", 0, 0, 2, 4), room("bedroom", "bedroom", 2, 0, 4.5, 4)];
    expect(validatePlan(withGround({ rooms }))).toContain(
      'Planta baja: "bedroom" lies outside the footprint',
    );
  });

  test("a storey's rooms fill the footprint, with no gap left", () => {
    const rooms = [room("hall", "hall", 0, 0, 2, 4), room("bedroom", "bedroom", 2, 0, 3.5, 4)];
    expect(validatePlan(withGround({ rooms }))).toContain(
      "Planta baja: its rooms cover 22 m² of the footprint's 24 m²",
    );
  });

  test("the plot's rooms lie inside the plot and around the house, not under it", () => {
    const rooms = [
      ...plotFloor.rooms,
      { ...room("pool", "pool", 1, 3, 3, 6), open: true },
      { ...room("deck", "deck", 7, 4, 2, 2), open: true },
    ];
    expect(validatePlan({ ...house, floors: [{ ...plotFloor, rooms }, ground] })).toEqual(
      expect.arrayContaining([
        'Exterior: "pool" lies under the house',
        'Exterior: "deck" lies outside the plot',
      ]),
    );
  });

  describe("every opening sits in a real wall", () => {
    const issuesWith = (opening: Opening, changes: Partial<PlanFloor> = {}) =>
      validatePlan(withGround({ openings: [entrance, bedroomDoor, opening], ...changes }));

    test("it fits on its room's side", () => {
      expect(issuesWith({ ...bedroomDoor, at: 3.8 })).toContain(
        'Planta baja: the door of "hall" at 3.8 does not fit on its east wall',
      );
    });

    test("an opening names a room of its floor", () => {
      expect(issuesWith({ ...bedroomDoor, room: "kitchen" })).toContain(
        'Planta baja: an opening names "kitchen", which is not a room of the floor',
      );
    });

    test("a door or a passage joins two rooms, not a room and the outside", () => {
      expect(issuesWith({ ...bedroomDoor, side: "west" })).toContain(
        'Planta baja: the door of "hall" at 2 leads outside, but it has to join two rooms',
      );
    });

    test("a window, a sliding door and the front door are on an outer wall", () => {
      expect(
        issuesWith({ kind: "window", room: "hall", side: "east", at: 3, width: 1, sill: 1 }),
      ).toContain('Planta baja: the window of "hall" at 3 is not on an outer wall');
    });

    test("it lies across a single room, not two", () => {
      const rooms = [
        room("hall", "hall", 0, 0, 2, 4),
        room("bedroom", "bedroom", 2, 0, 4, 2),
        room("bath", "bath", 2, 2, 4, 2),
      ];
      expect(
        issuesWith({ ...bedroomDoor, room: "hall" }, { rooms, openings: [entrance, bedroomDoor] }),
      ).toContain('Planta baja: the door of "hall" at 2 spans more than one wall');
    });

    test("an open-air room has no walls of its own to the outside", () => {
      const rooms = [
        room("hall", "hall", 0, 0, 2, 4),
        { ...room("patio", "deck", 2, 0, 4, 4), open: true },
      ];
      const window: Opening = {
        kind: "window",
        room: "patio",
        side: "south",
        at: 4,
        width: 1,
        sill: 1,
      };
      expect(issuesWith(window, { rooms })).toContain(
        'Planta baja: the window of "patio" at 4 has no wall to sit in',
      );
    });

    test("a door hangs from one end of its wall", () => {
      expect(issuesWith({ ...bedroomDoor, hinge: "east" })).toContain(
        'Planta baja: the door of "hall" at 2 hangs from its east end, which an east wall does not have',
      );
    });

    test("two openings do not overlap on the same wall, declared from either side", () => {
      const fromBedroom: Opening = { ...bedroomDoor, room: "bedroom", side: "west", at: 2.5 };
      expect(issuesWith(fromBedroom)).toContain(
        'Planta baja: the door of "hall" at 2 and the door of "bedroom" at 2.5 overlap',
      );
    });
  });
  describe("every room can be reached from the hall, through doors", () => {
    test("a room with no door to it cannot be reached", () => {
      expect(validatePlan(withGround({ openings: [entrance] }))).toContain(
        'Planta baja: "bedroom" cannot be reached from "hall"',
      );
    });

    test("the ground floor has a front door to start from", () => {
      expect(validatePlan(withGround({ openings: [bedroomDoor] }))).toContain(
        "Planta baja: it has no front door",
      );
    });

    test("an upper floor starts from the stair, and open-air rooms join where they meet", () => {
      const stairRoom = room("stair", "stair", 0, 0, 2, 4);
      const stairs = withGround({
        rooms: [stairRoom, room("hall", "hall", 2, 0, 4, 4)],
        openings: [
          { ...entrance, room: "hall", at: 4 },
          { kind: "passage", room: "stair", side: "east", at: 3, width: 1 },
        ],
      });
      const roof: PlanFloor = {
        id: "roof",
        name: "Azotea",
        kind: "roof",
        rooms: [
          stairRoom,
          { ...room("terrace", "terrace", 2, 0, 4, 2), open: true },
          { ...room("planter", "planter", 2, 2, 4, 2), open: true },
        ],
        openings: [{ ...bedroomDoor, room: "stair", side: "east", at: 3 }],
      };
      expect(validatePlan({ ...stairs, floors: [...stairs.floors, roof] })).toEqual([]);
      const shut = { ...roof, openings: [] };
      expect(validatePlan({ ...stairs, floors: [...stairs.floors, shut] })).toEqual([
        'Azotea: "terrace" cannot be reached from "stair"',
        'Azotea: "planter" cannot be reached from "stair"',
      ]);
    });
  });
  test("the stair stands in the same place on every floor it serves", () => {
    const first: PlanFloor = {
      ...ground,
      id: "first",
      name: "Primera planta",
      rooms: [room("stair", "stair", 0, 0, 2, 4), room("bedroom", "bedroom", 2, 0, 4, 4)],
      openings: [{ ...bedroomDoor, room: "stair" }],
    };
    const groundWithStair: PlanFloor = {
      ...ground,
      rooms: [
        room("hall", "hall", 0, 0, 2, 2),
        room("stair", "stair", 0, 2, 2, 2),
        room("bedroom", "bedroom", 2, 0, 4, 4),
      ],
      openings: [
        entrance,
        { ...bedroomDoor, at: 1 },
        { kind: "passage", room: "hall", side: "south", at: 1, width: 1 },
      ],
    };
    const plan = { ...house, floors: [plotFloor, groundWithStair, first] };
    expect(validatePlan(plan)).toEqual([
      'Primera planta: the stair is not where it is on "Planta baja"',
    ]);
  });

  test("the stair is entered from the same end on every floor, so its flights stack", () => {
    const groundRooms = [
      room("hall", "hall", 0, 0, 2, 1),
      room("stair", "stair", 0, 1, 2, 3),
      room("bedroom", "bedroom", 2, 0, 4, 4),
    ];
    const groundWithStair: PlanFloor = {
      ...ground,
      rooms: groundRooms,
      openings: [
        entrance,
        { ...bedroomDoor, at: 0.5 },
        { kind: "passage", room: "hall", side: "south", at: 1, width: 1 },
      ],
    };
    const first = (stairOpening: Opening): PlanFloor => ({
      ...ground,
      id: "first",
      name: "Primera planta",
      rooms: [room("landing", "corridor", 0, 0, 2, 1), ...groundRooms.slice(1)],
      openings: [stairOpening, { ...bedroomDoor, room: "landing", at: 0.5 }],
    });
    const fromNorth: Opening = { kind: "passage", room: "stair", side: "north", at: 1, width: 1 };
    const fromSouth: Opening = { ...bedroomDoor, room: "stair", at: 3.5 };

    expect(
      validatePlan({ ...house, floors: [plotFloor, groundWithStair, first(fromNorth)] }),
    ).toEqual([]);
    expect(
      validatePlan({ ...house, floors: [plotFloor, groundWithStair, first(fromSouth)] }),
    ).toEqual([
      'Primera planta: the stair is entered from its south end, not its north end as on "Planta baja"',
    ]);
  });

  describe("m² add up", () => {
    test("the garden declares what the plot leaves around the house and the rest", () => {
      const pool = { ...room("pool", "pool", 0, 5, 4, 2), open: true };
      const floors = [{ ...plotFloor, rooms: [...plotFloor.rooms, pool] }, ground];
      expect(validatePlan({ ...house, floors })).toEqual([
        'Exterior: "garden" declares 76 m² but takes 68 m²',
      ]);
    });

    test("any other room takes its rectangle", () => {
      const rooms = [{ ...room("hall", "hall", 0, 0, 2, 4), area: 9 }, ground.rooms[1]!];
      expect(validatePlan(withGround({ rooms }))).toEqual([
        'Planta baja: "hall" declares 9 m² but takes 8 m²',
      ]);
    });
  });

  test("a wardrobe stands inside its room", () => {
    const bedroom = { ...ground.rooms[1]!, wardrobe: { x: 5.6, z: 0, w: 0.6, d: 2 } };
    expect(validatePlan(withGround({ rooms: [ground.rooms[0]!, bedroom] }))).toEqual([
      'Planta baja: the wardrobe of "bedroom" lies outside it',
    ]);
  });
});

describe("planFigures", () => {
  test("Villa Mar: two storeys of 120 m² on a 462 m² plot, four bedrooms and three bathrooms", () => {
    expect(planFigures(villaMarPlan)).toEqual({
      builtArea: 240,
      plotArea: 462,
      bedrooms: 4,
      bathrooms: 3,
    });
  });

  test("the roof terrace is not built area", () => {
    const roof: PlanFloor = { ...ground, id: "roof", name: "Azotea", kind: "roof" };
    expect(planFigures({ ...house, floors: [...house.floors, roof] }).builtArea).toBe(24);
  });
});

describe("floorGeometry", () => {
  const wallsOn = (floor: PlanFloor, at: { x: number } | { z: number }) =>
    floorGeometry(floor).walls.filter((wall) =>
      "x" in at ? wall.x1 === at.x && wall.x2 === at.x : wall.z1 === at.z && wall.z2 === at.z,
    );

  test("the wall between two rooms is interior, with the door's gap cut out of it", () => {
    expect(wallsOn(ground, { x: 2 })).toEqual([
      { x1: 2, z1: 0, x2: 2, z2: 1.6, kind: "interior" },
      { x1: 2, z1: 2.4, x2: 2, z2: 4, kind: "interior" },
    ]);
  });

  test("the outer walls run round the house, with the front door's gap", () => {
    expect(wallsOn(ground, { z: 0 })).toEqual([
      { x1: 0, z1: 0, x2: 0.55, z2: 0, kind: "exterior" },
      { x1: 1.45, z1: 0, x2: 2, z2: 0, kind: "exterior" },
      { x1: 2, z1: 0, x2: 6, z2: 0, kind: "exterior" },
    ]);
    expect(wallsOn(ground, { x: 0 })).toEqual([{ x1: 0, z1: 0, x2: 0, z2: 4, kind: "exterior" }]);
  });

  test("a door hangs from its hinge and opens a quarter turn into the side it opens to", () => {
    const [, door] = floorGeometry(ground).openings;
    expect(door).toEqual({
      kind: "door",
      room: "hall",
      x1: 2,
      z1: 1.6,
      x2: 2,
      z2: 2.4,
      // Hinged at the north end, opening out of the hall into the bedroom, to the east.
      swing: { hinge: { x: 2, z: 1.6 }, leaf: { x: 2.8, z: 1.6 }, clockwise: true },
    });
  });

  test("open-air rooms end in a railing and have nothing between them", () => {
    const roof: PlanFloor = {
      id: "roof",
      name: "Azotea",
      kind: "roof",
      rooms: [
        { ...room("solarium", "solarium", 0, 0, 3, 4), open: true },
        { ...room("lounge", "lounge", 3, 0, 3, 4), open: true },
      ],
      openings: [],
    };
    const { walls } = floorGeometry(roof);
    expect(walls.every(({ kind }) => kind === "railing")).toBe(true);
    expect(wallsOn(roof, { x: 3 })).toEqual([]);
  });

  test("the plot has no walls, and each room keeps its m²", () => {
    const { walls, rooms } = floorGeometry(plotFloor);
    expect(walls).toEqual([]);
    expect(rooms.map(({ id, area }) => [id, area])).toEqual([["garden", 76]]);
  });
});

describe("Villa Mar's layout", () => {
  const floors = villaMarPlan.floors as PlanFloor[];
  const floor = (id: string) => floors.find((candidate) => candidate.id === id)!;
  const roomsOf = (kind: Room["kind"]) =>
    floors.flatMap((f) =>
      f.rooms.filter((r) => r.kind === kind).map((r) => ({ floor: f, room: r })),
    );
  const openingsOf = (f: PlanFloor, roomId: string) =>
    f.openings.filter(({ room }) => room === roomId);

  test("the front door opens onto the hall from the north", () => {
    const entrances = floor("ground").openings.filter(({ kind }) => kind === "entrance");
    expect(entrances).toHaveLength(1);
    expect(entrances[0]).toMatchObject({ room: "recibidor", side: "north" });
  });

  test("the living and dining rooms open to the south, onto the porch, with sliding doors", () => {
    for (const id of ["salon", "comedor"]) {
      expect(openingsOf(floor("ground"), id)).toContainEqual(
        expect.objectContaining({ kind: "sliding", side: "south" }),
      );
    }
  });

  test("every bedroom has a wardrobe, and the suite a dressing room that leads to its bathroom", () => {
    const bedrooms = roomsOf("bedroom");
    expect(bedrooms).toHaveLength(4);
    for (const { room } of bedrooms.filter(({ room }) => room.id !== "suite")) {
      expect(room.wardrobe, room.id).toBeDefined();
    }
    const first = floor("first");
    expect(openingsOf(first, "suite")).toContainEqual(
      expect.objectContaining({ kind: "passage", side: "north" }),
    );
    expect(openingsOf(first, "vestidor")).toContainEqual(
      expect.objectContaining({ kind: "door", side: "north" }),
    );
  });

  test("the stair is stepped on and off at its south end on every floor, up to the roof", () => {
    expect(floors.filter(({ kind }) => kind !== "plot").map(stairEntry)).toEqual([
      "south",
      "south",
      "south",
    ]);
  });

  test("every bathroom has a high window", () => {
    for (const { floor: f, room } of roomsOf("bath")) {
      expect(
        openingsOf(f, room.id).some((o) => o.kind === "window" && o.sill >= 1.5),
        room.id,
      ).toBe(true);
    }
  });
});
