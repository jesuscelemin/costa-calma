import type { HousePlan, Room } from "../schema";

// Casa Pinar's plan (ADR 0006, ADR 0008), in Villa Duna Blanca's language: sand render,
// travertine, walnut and pergolas. Metres; x grows to the east, z to the south, where the sea is.
// One half of a semi-detached pair on the second row, up the hill: its party wall stands blind on
// the plot's west edge, and the other half is its mirror. Plot of 13 × 26 m.
//
// The second row's road runs below it, to the south, between the houses and the sea: the house
// is entered from the south, through a gate beside a parking under a pergola, and the living room
// and the suite look over the road to the sea. The garden and the pool are behind it, to the north.
//
// Ground floor, 11 × 12 m: a band against the party wall with the hall, the landing, a guest
// toilet, the utility room and the U stair; the kitchen with its travertine island, open to the
// pool behind, and the living and dining room open to the porch and the sea.
//
// First floor: the suite to the south, its dressing room and its bathroom, out to a terrace that
// flies over the porch; two bedrooms to the north, over the garden, and the bathroom they share.
//
// Roof: a solarium over the whole house, with a chill-out under a pergola, to the sea.

const room = (
  id: string,
  name: string,
  kind: Room["kind"],
  [x0, x1]: [number, number],
  [z0, z1]: [number, number],
  orientation: Room["orientation"],
  extra: Partial<Room> = {},
): Room => ({
  id,
  name,
  kind,
  x: x0,
  z: z0,
  w: Math.round((x1 - x0) * 100) / 100,
  d: Math.round((z1 - z0) * 100) / 100,
  orientation,
  ...extra,
});
const open = { open: true } as const;

export const casaPinarPlan = {
  plot: { x: 0, z: 0, w: 13, d: 26 },
  partyWall: "west",
  section: { runs: "north-south", at: 7.75 },
  tour: [
    {
      floor: "ground",
      room: "recibidor",
      line: "Se entra desde la calle, junto a la pérgola del coche, mirando al mar.",
    },
    {
      floor: "ground",
      room: "salon",
      line: "Salón y comedor abiertos al porche y, por encima de la calle, al Mediterráneo.",
    },
    {
      floor: "plot",
      room: "porche",
      line: "Un porche de cara al mar, bajo la terraza de la suite.",
    },
    {
      floor: "ground",
      room: "cocina",
      line: "La cocina, con su isla de travertino, se abre detrás a la piscina y al jardín.",
    },
    {
      floor: "first",
      room: "suite",
      line: "La suite mira al mar desde su terraza volada.",
    },
    {
      floor: "roof",
      room: "solarium",
      line: "Una azotea entera, con su pérgola, por encima de los tejados hasta el mar.",
    },
  ],
  floors: [
    {
      id: "plot",
      name: "Exterior",
      kind: "plot",
      rooms: [
        room("jardin", "Jardín", "garden", [0, 13], [0, 26], "Norte", { ...open, area: 77 }),
        room("piscina", "Piscina", "pool", [2, 10], [2, 5.5], "Norte", open),
        room("tarima", "Tarima y hamacas", "solarium", [2, 10], [5.5, 8], "Norte", {
          ...open,
          furniture: [
            { piece: "sun-lounger", x: 4, z: 6.75, facing: "north" },
            { piece: "sun-lounger", x: 5.2, z: 6.75, facing: "north" },
          ],
        }),
        room("paso-lateral", "Paso lateral", "patio", [11, 13], [8, 21], "Este", open),
        room("porche", "Porche", "deck", [4.5, 11], [21, 23.5], "Sur", {
          ...open,
          furniture: [
            { piece: "outdoor-sofa", x: 7.75, z: 21.75, facing: "south" },
            { piece: "outdoor-coffee-table", x: 7.75, z: 22.9, facing: "south" },
          ],
        }),
        room("aparcamiento", "Aparcamiento", "garage", [0, 2.8], [21, 26], "Sur", open),
        room("acceso", "Acceso", "patio", [2.8, 4.5], [21, 26], "Sur", open),
        room("jardin-delantero", "Jardín delantero", "patio", [4.5, 11], [23.5, 26], "Sur", open),
      ],
      openings: [],
      canopies: [{ kind: "pergola", x: 0, z: 21, w: 2.8, d: 5 }],
    },
    {
      id: "ground",
      name: "Planta baja",
      kind: "storey",
      rooms: [
        room("escalera", "Escalera", "stair", [0, 2.4], [9, 14], "Norte"),
        room("lavadero", "Lavadero", "utility", [2.4, 4.5], [9, 11.5], "Norte"),
        room("aseo", "Aseo", "toilet", [2.4, 4.5], [11.5, 14], "Norte"),
        room("distribuidor", "Distribuidor", "corridor", [0, 4.5], [14, 16.5], "Sur"),
        room("recibidor", "Recibidor", "hall", [0, 4.5], [16.5, 21], "Sur"),
        room("cocina", "Cocina", "kitchen", [4.5, 11], [9, 14], "Norte"),
        room("salon", "Salón y comedor", "living", [4.5, 11], [14, 21], "Sur", {
          furniture: [
            { piece: "rug", x: 7.75, z: 18.6, facing: "south" },
            { piece: "sofa", x: 7.75, z: 17.6, facing: "south" },
            { piece: "coffee-table", x: 7.75, z: 18.9, facing: "south" },
            { piece: "dining-table", x: 7.75, z: 15.4, facing: "south" },
          ],
        }),
      ],
      openings: [
        {
          kind: "entrance",
          room: "recibidor",
          side: "south",
          at: 3.65,
          width: 1.2,
          opens: "in",
          hinge: "east",
        },
        { kind: "passage", room: "recibidor", side: "north", at: 2.25, width: 3 },
        { kind: "passage", room: "recibidor", side: "east", at: 18.75, width: 1.6 },
        { kind: "passage", room: "distribuidor", side: "north", at: 1.2, width: 1.8 },
        {
          kind: "door",
          room: "aseo",
          side: "south",
          at: 3.45,
          width: 0.7,
          opens: "in",
          hinge: "east",
        },
        { kind: "passage", room: "distribuidor", side: "east", at: 15.25, width: 1.4 },
        {
          kind: "door",
          room: "lavadero",
          side: "east",
          at: 10.25,
          width: 0.8,
          opens: "in",
          hinge: "north",
        },
        { kind: "passage", room: "cocina", side: "south", at: 7.75, width: 5 },
        { kind: "sliding", room: "cocina", side: "north", at: 7.75, width: 4 },
        { kind: "window", room: "cocina", side: "east", at: 11.5, width: 1.6, sill: 1.05 },
        { kind: "sliding", room: "salon", side: "south", at: 7.75, width: 5 },
        { kind: "window", room: "salon", side: "east", at: 17.5, width: 2, sill: 0.5 },
        { kind: "window", room: "lavadero", side: "north", at: 3.45, width: 1, sill: 1.6 },
      ],
    },
    {
      id: "first",
      name: "Primera planta",
      kind: "storey",
      rooms: [
        room("escalera", "Escalera", "stair", [0, 2.4], [9, 14], "Norte"),
        room("bano", "Baño", "bath", [2.4, 4.5], [9, 13], "Norte"),
        room("dormitorio-2", "Dormitorio 2", "bedroom", [4.5, 7.75], [9, 13], "Norte", {
          furniture: [{ piece: "bed", x: 6.125, z: 10.1, facing: "south" }],
        }),
        room("dormitorio-3", "Dormitorio 3", "bedroom", [7.75, 11], [9, 13], "Norte", {
          furniture: [{ piece: "bed", x: 9.375, z: 10.1, facing: "south" }],
        }),
        room("rellano", "Rellano", "corridor", [0, 2.4], [14, 15], "Sur"),
        room("pasillo", "Pasillo", "corridor", [2.4, 11], [13, 15], "Este"),
        room("vestidor", "Vestidor", "dressing", [0, 4.5], [15, 17.5], "Oeste"),
        room("bano-suite", "Baño de la suite", "bath", [0, 4.5], [17.5, 21], "Sur"),
        room("suite", "Suite principal", "bedroom", [4.5, 11], [15, 21], "Sur", {
          furniture: [
            { piece: "upholstered-bed", x: 7.75, z: 16.3, facing: "south" },
            { piece: "walnut-nightstand", x: 6.4, z: 15.3, facing: "south" },
            { piece: "walnut-nightstand", x: 9.1, z: 15.3, facing: "south" },
          ],
        }),
        room("terraza", "Terraza volada", "terrace", [4.5, 11], [21, 23.5], "Sur", open),
      ],
      openings: [
        { kind: "passage", room: "rellano", side: "north", at: 1.2, width: 1.8 },
        { kind: "passage", room: "rellano", side: "east", at: 14.5, width: 0.9 },
        {
          kind: "door",
          room: "bano",
          side: "south",
          at: 3.45,
          width: 0.8,
          opens: "in",
          hinge: "east",
        },
        {
          kind: "door",
          room: "dormitorio-2",
          side: "south",
          at: 5.2,
          width: 0.9,
          opens: "in",
          hinge: "west",
        },
        {
          kind: "door",
          room: "dormitorio-3",
          side: "south",
          at: 8.5,
          width: 0.9,
          opens: "in",
          hinge: "west",
        },
        {
          kind: "door",
          room: "suite",
          side: "north",
          at: 10.3,
          width: 0.9,
          opens: "in",
          hinge: "east",
        },
        { kind: "passage", room: "suite", side: "west", at: 16.25, width: 1 },
        {
          kind: "door",
          room: "bano-suite",
          side: "north",
          at: 2.25,
          width: 0.8,
          opens: "in",
          hinge: "east",
        },
        { kind: "sliding", room: "suite", side: "south", at: 7.75, width: 5 },
        { kind: "window", room: "suite", side: "east", at: 18, width: 2, sill: 0.5 },
        { kind: "window", room: "dormitorio-2", side: "north", at: 6.125, width: 2, sill: 0.5 },
        { kind: "window", room: "dormitorio-3", side: "north", at: 9.375, width: 2, sill: 0.5 },
        { kind: "window", room: "bano", side: "north", at: 3.45, width: 1, sill: 1.6 },
      ],
    },
    {
      id: "roof",
      name: "Azotea",
      kind: "roof",
      rooms: [
        room("escalera", "Escalera", "stair", [0, 2.4], [9, 14], "Norte"),
        room("salida", "Salida", "deck", [0, 2.4], [14, 15], "Sur", open),
        room("jardinera", "Jardinera", "planter", [0, 2.4], [15, 21], "Oeste", open),
        room("solarium", "Solárium", "solarium", [2.4, 11], [9, 21], "Sur", {
          ...open,
          furniture: [
            { piece: "sun-lounger", x: 6, z: 12, facing: "south" },
            { piece: "sun-lounger", x: 7.2, z: 12, facing: "south" },
            { piece: "outdoor-sofa", x: 7.75, z: 17, facing: "south" },
          ],
        }),
      ],
      openings: [
        {
          kind: "door",
          room: "salida",
          side: "north",
          at: 1.2,
          width: 1,
          opens: "out",
          hinge: "west",
        },
      ],
      canopies: [{ kind: "pergola", x: 2.4, z: 15, w: 8.6, d: 6 }],
    },
  ],
} satisfies HousePlan;
