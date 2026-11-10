import type { HousePlan, Room } from "../schema";

// Casa Olivo's plan (ADR 0006, ADR 0008), in Villa Duna Blanca's language: sand render,
// travertine, walnut and pergolas. Metres; x grows to the east, z to the south, where the sea is.
// One storey in a U round a courtyard with an olive tree, on the second row up the hill, on a
// 24 × 25 m plot, with a solarium on top of the living room.
//
// The second row's road runs below it, to the south, between the houses and the sea: the house
// is entered from the south, beside a parking for two cars under a pergola, and its front, the
// kitchen, the living room, the hall and the second bedroom, looks over the road to the sea. The
// courtyard opens to the north, to the garden and the pool behind.
//
// West wing: the third bedroom, its bathroom and the utility room, along a glass gallery onto the
// courtyard. East wing: the suite, open to the garden, its dressing room and its bathroom, along
// another gallery. Beside the living room, a stair up to the solarium.

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

export const casaOlivoPlan = {
  plot: { x: 0, z: 0, w: 24, d: 25 },
  section: { runs: "north-south", at: 11.75 },
  tour: [
    {
      floor: "ground",
      room: "recibidor",
      line: "Desde la calle, el recibidor se abre al mar por delante y al olivo por detrás.",
    },
    {
      floor: "ground",
      room: "salon",
      line: "El salón, acristalado a los dos lados: al mar y al patio del olivo.",
    },
    {
      floor: "plot",
      room: "patio",
      line: "La casa abraza el patio del olivo, abierto al jardín y a la piscina.",
    },
    {
      floor: "ground",
      room: "galeria-este",
      line: "Una galería de vidrio a lo largo del patio lleva a la suite.",
    },
    {
      floor: "ground",
      room: "suite",
      line: "La suite se abre al jardín de atrás y a la piscina.",
    },
    {
      floor: "roof",
      room: "solarium",
      line: "Encima del salón, un solárium para mirar el mar por encima de la calle.",
    },
  ],
  floors: [
    {
      id: "plot",
      name: "Exterior",
      kind: "plot",
      rooms: [
        room("jardin", "Jardín", "garden", [0, 24], [0, 25], "Norte", { ...open, area: 198.5 }),
        room("piscina", "Piscina", "pool", [6, 18], [1.5, 5], "Norte", open),
        room("tarima", "Tarima", "solarium", [6, 18], [5, 6], "Norte", open),
        room("patio", "Patio del olivo", "patio", [8.5, 15], [6, 14], "Norte", {
          ...open,
          tree: { x: 11.75, z: 10 },
        }),
        room("terraza", "Terraza al mar", "deck", [7, 15], [20, 22.5], "Sur", {
          ...open,
          furniture: [
            { piece: "outdoor-sofa", x: 11, z: 20.75, facing: "south" },
            { piece: "outdoor-coffee-table", x: 11, z: 21.9, facing: "south" },
          ],
        }),
        room("aparcamiento", "Aparcamiento", "garage", [1, 7], [20, 25], "Sur", open),
        room("acceso", "Acceso", "patio", [15, 18.5], [20, 25], "Sur", open),
      ],
      openings: [],
      canopies: [{ kind: "pergola", x: 1, z: 20, w: 6, d: 5 }],
    },
    {
      id: "ground",
      name: "Planta baja",
      kind: "storey",
      rooms: [
        room("dormitorio-3", "Dormitorio 3", "bedroom", [2, 7], [6, 10.5], "Norte", {
          furniture: [{ piece: "bed", x: 3.2, z: 8.25, facing: "east" }],
        }),
        room("bano-3", "Baño 3", "bath", [2, 7], [10.5, 12.5], "Oeste"),
        room("lavadero", "Lavadero", "utility", [2, 7], [12.5, 14], "Oeste"),
        room("galeria-oeste", "Galería", "corridor", [7, 8.5], [6, 14], "Este"),
        room("cocina", "Cocina", "kitchen", [2, 7], [14, 20], "Sur"),
        room("salon", "Salón y comedor", "living", [7, 13], [14, 20], "Sur", {
          furniture: [
            { piece: "rug", x: 10, z: 18.3, facing: "south" },
            { piece: "sofa", x: 10, z: 17.3, facing: "south" },
            { piece: "coffee-table", x: 10, z: 18.6, facing: "south" },
            { piece: "dining-table", x: 10, z: 15.4, facing: "south" },
          ],
        }),
        room("paso", "Paso", "hall", [13, 15], [14, 15], "Sur"),
        room("escalera", "Escalera", "stair", [13, 15], [15, 20], "Sur"),
        room("recibidor", "Recibidor", "hall", [15, 18.5], [14, 20], "Sur"),
        room("bano-2", "Baño 2", "bath", [18.5, 22], [14, 15.5], "Este"),
        room("dormitorio-2", "Dormitorio 2", "bedroom", [18.5, 22], [15.5, 20], "Sur", {
          furniture: [{ piece: "bed", x: 20.25, z: 16.7, facing: "south" }],
        }),
        room("galeria-este", "Galería", "corridor", [15, 16.5], [6, 14], "Oeste"),
        room("suite", "Suite principal", "bedroom", [16.5, 22], [6, 11], "Norte", {
          furniture: [
            { piece: "upholstered-bed", x: 20.2, z: 9.8, facing: "north" },
            { piece: "walnut-nightstand", x: 18.75, z: 10.75, facing: "north" },
            { piece: "walnut-nightstand", x: 21.6, z: 10.75, facing: "north" },
          ],
        }),
        room("vestidor", "Vestidor", "dressing", [16.5, 19], [11, 14], "Este"),
        room("bano-suite", "Baño de la suite", "bath", [19, 22], [11, 14], "Este"),
      ],
      openings: [
        {
          kind: "entrance",
          room: "recibidor",
          side: "south",
          at: 16.75,
          width: 1.2,
          opens: "in",
          hinge: "east",
        },
        { kind: "passage", room: "recibidor", side: "west", at: 14.5, width: 0.9 },
        { kind: "passage", room: "paso", side: "west", at: 14.5, width: 0.9 },
        { kind: "passage", room: "paso", side: "south", at: 14, width: 1.6 },
        { kind: "passage", room: "recibidor", side: "north", at: 15.75, width: 1.4 },
        {
          kind: "door",
          room: "bano-2",
          side: "west",
          at: 14.75,
          width: 0.7,
          opens: "in",
          hinge: "north",
        },
        {
          kind: "door",
          room: "dormitorio-2",
          side: "west",
          at: 17,
          width: 0.9,
          opens: "in",
          hinge: "south",
        },
        {
          kind: "door",
          room: "suite",
          side: "west",
          at: 8.5,
          width: 0.9,
          opens: "in",
          hinge: "north",
        },
        { kind: "passage", room: "suite", side: "south", at: 17.3, width: 0.9 },
        {
          kind: "door",
          room: "bano-suite",
          side: "west",
          at: 12.5,
          width: 0.8,
          opens: "in",
          hinge: "north",
        },
        { kind: "sliding", room: "galeria-este", side: "west", at: 10, width: 6 },
        { kind: "sliding", room: "salon", side: "north", at: 11, width: 3.6 },
        { kind: "passage", room: "salon", side: "west", at: 17, width: 4 },
        { kind: "sliding", room: "salon", side: "south", at: 10, width: 5 },
        { kind: "passage", room: "galeria-oeste", side: "south", at: 7.75, width: 1.2 },
        {
          kind: "door",
          room: "dormitorio-3",
          side: "east",
          at: 8,
          width: 0.9,
          opens: "in",
          hinge: "north",
        },
        {
          kind: "door",
          room: "bano-3",
          side: "east",
          at: 11.5,
          width: 0.8,
          opens: "in",
          hinge: "north",
        },
        { kind: "sliding", room: "galeria-oeste", side: "east", at: 10, width: 6 },
        {
          kind: "door",
          room: "lavadero",
          side: "south",
          at: 4.5,
          width: 0.8,
          opens: "out",
          hinge: "west",
        },
        { kind: "window", room: "cocina", side: "south", at: 4.5, width: 3, sill: 1.05 },
        { kind: "window", room: "cocina", side: "west", at: 17, width: 2, sill: 1.05 },
        { kind: "sliding", room: "suite", side: "north", at: 19.25, width: 4 },
        { kind: "window", room: "dormitorio-3", side: "north", at: 4.5, width: 3, sill: 0.5 },
        { kind: "window", room: "dormitorio-2", side: "south", at: 20.25, width: 2.5, sill: 0.5 },
        { kind: "window", room: "bano-3", side: "west", at: 11.5, width: 1, sill: 1.6 },
        { kind: "window", room: "bano-2", side: "east", at: 14.75, width: 0.8, sill: 1.6 },
        { kind: "window", room: "bano-suite", side: "east", at: 12.5, width: 1.2, sill: 1.6 },
      ],
    },
    {
      id: "roof",
      name: "Azotea",
      kind: "roof",
      rooms: [
        room("salida", "Salida", "deck", [13, 15], [14, 15], "Norte", open),
        room("escalera", "Escalera", "stair", [13, 15], [15, 20], "Sur"),
        room("solarium", "Solárium", "solarium", [7, 13], [14, 20], "Sur", {
          ...open,
          furniture: [
            { piece: "sun-lounger", x: 9, z: 17.5, facing: "south" },
            { piece: "sun-lounger", x: 10.2, z: 17.5, facing: "south" },
          ],
        }),
      ],
      openings: [
        {
          kind: "door",
          room: "escalera",
          side: "north",
          at: 14,
          width: 1,
          opens: "out",
          hinge: "west",
        },
      ],
      canopies: [{ kind: "pergola", x: 7, z: 14, w: 6, d: 3 }],
    },
  ],
} satisfies HousePlan;
