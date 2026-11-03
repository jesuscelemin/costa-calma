import { describe, expect, test } from "vitest";

import { floorGeometry, planFigures, stairEntry, validatePlan } from "./plan";
import { casaDunaPlan } from "./plans/casa-duna";
import { casaPinarPlan } from "./plans/casa-pinar";
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

  test("a storey's rooms lie inside the plot", () => {
    const rooms = [room("hall", "hall", 0, 0, 2, 4), room("bedroom", "bedroom", 2, 0, 6.5, 4)];
    expect(validatePlan(withGround({ rooms }))).toContain(
      'Planta baja: "bedroom" lies outside the plot',
    );
  });

  describe("each floor stands on the one below", () => {
    // A first floor over the invented house: its stair arrives over the hall.
    const first = (rooms: Room[], openings: Opening[] = []): PlanFloor => ({
      id: "first",
      name: "Primera planta",
      kind: "storey",
      rooms: [room("stair", "stair", 0, 0, 2, 4), ...rooms],
      openings: [{ kind: "passage", room: "stair", side: "east", at: 2, width: 0.9 }, ...openings],
    });
    const withFirst = (floor: PlanFloor, base = ground): HousePlan => ({
      ...house,
      floors: [plotFloor, base, floor],
    });

    test("a storey may overhang the one below", () => {
      const overhanging = first([room("bedroom", "bedroom", 2, 0, 4, 6)]);
      expect(validatePlan(withFirst(overhanging))).toEqual([]);
    });

    test("but not stand on nothing", () => {
      const floating = first([
        room("bedroom", "bedroom", 2, 0, 4, 4),
        { ...room("terrace", "terrace", 6, 0, 2, 4), open: true },
      ]);
      expect(validatePlan(withFirst(floating))).toContain(
        'Primera planta: "terrace" stands on nothing',
      );
    });

    test("a roof terrace stands whole on the storey below", () => {
      const roof: PlanFloor = {
        ...first([{ ...room("solarium", "solarium", 2, 0, 4, 5), open: true }]),
        id: "roof",
        name: "Azotea",
        kind: "roof",
      };
      expect(validatePlan(withFirst(roof))).toContain(
        'Azotea: "solarium" does not stand on "Planta baja"',
      );
    });

    describe("a double height", () => {
      const living = { ...ground, rooms: [ground.rooms[0]!, room("living", "living", 2, 0, 4, 4)] };
      const doubleHeight = (openings: Opening[] = []) =>
        withFirst(
          first([room("void", "void", 4, 0, 2, 4), room("study", "study", 2, 0, 2, 4)], openings),
          living,
        );

      test("opens over a living room, dining room or hall", () => {
        expect(validatePlan(doubleHeight())).toEqual([]);
        expect(validatePlan(withFirst(doubleHeight().floors[2]!))).toContain(
          'Primera planta: the double height "void" is not over a living room, dining room or hall',
        );
      });

      test("has no floor: no door onto it, nor m² of its own", () => {
        const door: Opening = {
          kind: "door",
          room: "study",
          side: "east",
          at: 2,
          width: 0.8,
          opens: "out",
          hinge: "north",
        };
        expect(validatePlan(doubleHeight([door]))).toContain(
          'Primera planta: the door of "study" at 2 opens onto a double height, which has no floor',
        );
        expect(planFigures(doubleHeight()).builtArea).toBe(24 + 16);
      });

      test("meets the storey with a railing", () => {
        const plan = doubleHeight();
        const { walls } = floorGeometry(plan.floors[2]!, plan);
        expect(walls.filter(({ x1, x2 }) => x1 === 4 && x2 === 4)).toEqual([
          { x1: 4, z1: 0, x2: 4, z2: 4, kind: "railing" },
        ]);
      });
    });
  });

  test("a canopy lies inside the plot", () => {
    const canopies = [{ kind: "pergola" as const, x: 0, z: 4, w: 6, d: 5 }];
    expect(validatePlan(withGround({ canopies }))).toEqual([
      "Planta baja: a pergola lies outside the plot",
    ]);
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

  describe("a semi-detached house's party wall", () => {
    // The invented house as one half of a pair: its east wall, on the plot's east edge, is shared
    // with the neighbour.
    const plot = { ...house.plot, w: 8 };
    const half: HousePlan = {
      ...house,
      plot,
      partyWall: "east",
      floors: [{ ...plotFloor, rooms: [{ ...plotFloor.rooms[0]!, ...plot, area: 56 }] }, ground],
    };

    test("the half of a pair is coherent", () => {
      expect(validatePlan(half)).toEqual([]);
    });

    test("it has no opening", () => {
      const window: Opening = {
        kind: "window",
        room: "bedroom",
        side: "east",
        at: 2,
        width: 1,
        sill: 0.9,
      };
      expect(
        validatePlan({
          ...half,
          floors: [half.floors[0]!, { ...ground, openings: [...ground.openings, window] }],
        }),
      ).toEqual(['Planta baja: the window of "bedroom" at 2 is in the party wall']);
    });

    test("the house reaches the plot's edge, where the neighbour's plot begins", () => {
      expect(validatePlan({ ...house, partyWall: "east" })).toContain(
        "The ground floor does not reach the plot's east edge, its party wall",
      );
    });
  });

  test("the section declared cuts through every floor of the house", () => {
    expect(validatePlan({ ...house, section: { runs: "north-south", at: 1 } })).toEqual([]);
    expect(validatePlan({ ...house, section: { runs: "north-south", at: 7 } })).toContain(
      "The section at x = 7 does not cut through Planta baja",
    );
    // Along a wall, between two rooms, it cuts through neither.
    expect(validatePlan({ ...house, section: { runs: "east-west", at: 4 } })).toContain(
      "The section at z = 4 does not cut through Planta baja",
    );
  });

  test("a wardrobe stands inside its room", () => {
    const bedroom = { ...ground.rooms[1]!, wardrobe: { x: 5.6, z: 0, w: 0.6, d: 2 } };
    expect(validatePlan(withGround({ rooms: [ground.rooms[0]!, bedroom] }))).toEqual([
      'Planta baja: the wardrobe of "bedroom" lies outside it',
    ]);
  });
});

describe("planFigures", () => {
  test("Villa Mar: 227 m² over two storeys on a 462 m² plot, four bedrooms and three bathrooms", () => {
    expect(planFigures(villaMarPlan)).toEqual({
      builtArea: 227,
      plotArea: 462,
      bedrooms: 4,
      bathrooms: 3,
      toilets: 0,
    });
  });

  test("the roof terrace is not built area", () => {
    const roof: PlanFloor = { ...ground, id: "roof", name: "Azotea", kind: "roof" };
    expect(planFigures({ ...house, floors: [...house.floors, roof] }).builtArea).toBe(24);
  });
});

describe("floorGeometry", () => {
  const wallsOn = (floor: PlanFloor, at: { x: number } | { z: number }) =>
    floorGeometry(floor, house).walls.filter((wall) =>
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
    const [, door] = floorGeometry(ground, house).openings;
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
    const { walls } = floorGeometry(roof, house);
    expect(walls.every(({ kind }) => kind === "railing")).toBe(true);
    expect(wallsOn(roof, { x: 3 })).toEqual([]);
  });

  test("the plot has no walls, and each room keeps its m²", () => {
    const { walls, rooms } = floorGeometry(plotFloor, house);
    expect(walls).toEqual([]);
    expect(rooms.map(({ id, area }) => [id, area])).toEqual([["garden", 76]]);
  });

  test("the wall shared with the neighbour is a party wall, the rest of the outer walls are not", () => {
    const { walls } = floorGeometry(ground, {
      ...house,
      plot: { ...house.plot, w: 8 },
      partyWall: "east",
    });
    expect(walls.filter(({ x1, x2 }) => x1 === 6 && x2 === 6)).toEqual([
      { x1: 6, z1: 0, x2: 6, z2: 4, kind: "party" },
    ]);
    expect(walls.filter(({ kind }) => kind === "party")).toHaveLength(1);
  });
});

// The same criteria for every house type: a hall the front door opens onto from the north, a day
// zone open to the south, bedrooms with a wardrobe, a suite that reaches its bathroom through the
// dressing room, bathrooms with a high window and one stair entered from the same end throughout.
const plans = [
  { name: "Villa Mar", plan: villaMarPlan as HousePlan },
  { name: "Casa Pinar", plan: casaPinarPlan as HousePlan },
  { name: "Casa Duna", plan: casaDunaPlan as HousePlan },
];

describe.each(plans)("$name's layout", ({ plan }) => {
  const floors = plan.floors;
  const floor = (id: string) => floors.find((candidate) => candidate.id === id)!;
  const roomsOf = (kind: Room["kind"]) =>
    floors.flatMap((f) =>
      f.rooms.filter((r) => r.kind === kind).map((r) => ({ floor: f, room: r })),
    );
  const openingsOf = (f: PlanFloor, roomId: string) =>
    f.openings.filter(({ room }) => room === roomId);

  test("is coherent", () => {
    expect(validatePlan(plan)).toEqual([]);
  });

  test("the front door opens onto the hall from the north", () => {
    const entrances = floor("ground").openings.filter(({ kind }) => kind === "entrance");
    expect(entrances).toHaveLength(1);
    expect(entrances[0]).toMatchObject({ room: "recibidor", side: "north" });
  });

  test("the living room opens to the south onto the porch, the dining room outdoors too", () => {
    expect(openingsOf(floor("ground"), "salon")).toContainEqual(
      expect.objectContaining({ kind: "sliding", side: "south" }),
    );
    expect(openingsOf(floor("ground"), "comedor")).toContainEqual(
      expect.objectContaining({ kind: "sliding" }),
    );
    const living = floor("ground").rooms.find(({ id }) => id === "salon")!;
    const porch = floor("plot").rooms.find(({ id }) => id === "porche")!;
    expect(porch.z).toBe(living.z + living.d);
    expect(porch.x < living.x + living.w && living.x < porch.x + porch.w).toBe(true);
  });

  test("every bedroom has a wardrobe, and the suite a dressing room that leads to its bathroom", () => {
    for (const { room } of roomsOf("bedroom").filter(({ room }) => room.id !== "suite")) {
      expect(room.wardrobe, room.id).toBeDefined();
    }
    const [suite] = roomsOf("bedroom").filter(({ room }) => room.id === "suite");
    expect(suite).toBeDefined();
    const f = suite!.floor;
    // What an opening of one room gives onto: the room just across its wall, at its centre.
    const across = (opening: Opening) => {
      const from = f.rooms.find(({ id }) => id === opening.room)!;
      const step = 0.01;
      const point = {
        north: { x: opening.at, z: from.z - step },
        south: { x: opening.at, z: from.z + from.d + step },
        west: { x: from.x - step, z: opening.at },
        east: { x: from.x + from.w + step, z: opening.at },
      }[opening.side];
      return f.rooms.find(
        (r) =>
          r.kind !== "garden" &&
          point.x > r.x &&
          point.x < r.x + r.w &&
          point.z > r.z &&
          point.z < r.z + r.d,
      )?.id;
    };
    const joined = (a: string, b: string) =>
      f.openings.some(
        (o) => (o.room === a && across(o) === b) || (o.room === b && across(o) === a),
      );
    expect(joined("suite", "vestidor")).toBe(true);
    expect(joined("vestidor", "bano-suite")).toBe(true);
    expect(joined("suite", "bano-suite")).toBe(false);
  });

  test("every bathroom and toilet has a high window", () => {
    for (const { floor: f, room } of [...roomsOf("bath"), ...roomsOf("toilet")]) {
      expect(
        openingsOf(f, room.id).some((o) => o.kind === "window" && o.sill >= 1.5),
        room.id,
      ).toBe(true);
    }
  });

  test("the stair, if any, is stepped on and off at its south end on every floor", () => {
    const entries = floors.filter(({ kind }) => kind !== "plot").map(stairEntry);
    const withStair = floors.filter((f) => f.rooms.some(({ kind }) => kind === "stair"));
    expect(entries.filter(Boolean)).toEqual(withStair.map(() => "south"));
  });
});

describe("planFigures of each house type", () => {
  test("Casa Pinar: 158 m² over two storeys on a 288 m² plot, three bedrooms, two bathrooms and a toilet", () => {
    expect(planFigures(casaPinarPlan)).toEqual({
      builtArea: 158,
      plotArea: 288,
      bedrooms: 3,
      bathrooms: 2,
      toilets: 1,
    });
  });

  test("Casa Duna: 151 m² on one storey on a 378 m² plot, three bedrooms and two bathrooms", () => {
    expect(planFigures(casaDunaPlan)).toEqual({
      builtArea: 151,
      plotArea: 378,
      bedrooms: 3,
      bathrooms: 2,
      toilets: 0,
    });
  });
});

describe("Casa Pinar, half of a semi-detached pair", () => {
  test("its party wall, to the east, is blind on both floors and drawn as a party wall", () => {
    expect(casaPinarPlan.partyWall).toBe("east");
    const plan: HousePlan = casaPinarPlan;
    for (const floor of plan.floors.filter(({ kind }) => kind === "storey")) {
      const { walls } = floorGeometry(floor, plan);
      // Every wall on the plot's edge is the party wall, except the terrace's railing.
      const east = walls.filter(
        ({ x1, x2, kind }) => x1 === 3.5 && x2 === 3.5 && kind !== "railing",
      );
      expect(east.map(({ kind }) => kind)).toEqual(east.map(() => "party"));
      // From the north corner of its rooms to the south one, without a gap.
      const enclosed = floor.rooms.filter((room) => !room.open && room.x + room.w === 3.5);
      const [north, south] = [
        Math.min(...enclosed.map(({ z }) => z)),
        Math.max(...enclosed.map(({ z, d }) => z + d)),
      ];
      expect(east.reduce((m, { z1, z2 }) => m + Math.abs(z2 - z1), 0)).toBeCloseTo(south - north);
    }
  });
});
