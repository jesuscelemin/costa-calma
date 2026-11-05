import type { HousePlan } from "../schema";

// Villa Mar's plan (ADR 0006, ADR 0008). Metres; x grows to the east, z to the south, where the sea
// is. On a 26 × 23 m plot that runs down to a 16 m pool.
//
// A contemporary Mediterranean villa of white volumes, stacked and flying, with its ground floor
// in glass. Ground floor, an L: a long day wing open to the south (living room, dining room and
// kitchen, one space behind floor-to-ceiling sliding doors), and a north wing with the hall, the
// stair, a toilet, the utility room and a study, which leaves an entrance patio to the west. The
// front door, to the north, opens onto the hall, and the hall straight through the dining room to
// the pool.
//
// First floor, two volumes: the suite's flies 4 m past the living room, over the porch, towards
// the pool; the bedrooms' sits over the kitchen and the north wing. A glass gallery joins them
// along the day wing, and between them a terrace opens to the south under a white frame. The
// stair is a U in the same 2,2 × 5 m well on every floor, stepped on and off at its south end.
//
// Roof: the stair's head opens onto a lounge under a pergola of white fins, a bridge over the
// gallery, a herb garden and the solarium on top of the suite.
//
// Its corte runs north–south through the living room and the suite flying over the porch.
//
// Its tour lands in front of the door, on the north, and walks straight into the hall; then the
// living room, out to the porch and the pool, back in to the kitchen and its island, up the
// stair to the suite, and out onto the terrace, where it rises over the whole house. The way
// between stops is worked out from the plan.

export const villaMarPlan = {
  plot: { x: -14, z: -10, w: 26, d: 23 },
  section: { runs: "north-south", at: -6.5 },
  tour: [
    {
      floor: "ground",
      room: "recibidor",
      line: "La puerta mira al norte, a la sombra; en línea recta, el comedor, la terraza y el agua.",
      // Straight in through the front door, looking down the house's axis to the pool.
      view: { from: { x: -0.5, y: 1.6, z: -4.4 }, to: { x: -0.5, y: 1.3, z: 10 } },
    },
    {
      floor: "ground",
      room: "salon",
      line: "Siete metros de vidrio de suelo a techo, abiertos al porche, al jardín y a la piscina.",
      view: { from: { x: -4.2, y: 1.6, z: 0.6 }, to: { x: -8.6, y: 1.4, z: 5.4 } },
    },
    {
      floor: "plot",
      room: "porche",
      line: "Bajo la suite, que vuela cuatro metros, el porche se asoma a la piscina.",
      view: { from: { x: -6.4, y: 1.6, z: 6.2 }, to: { x: -1.5, y: 1.1, z: 12 } },
    },
    {
      floor: "ground",
      room: "cocina",
      line: "Isla de roble y encimera de piedra bajo la ventana al este, abierta al comedor y a la terraza.",
      // From the dining room's side, the island ahead and the worktop along the window behind it.
      view: { from: { x: 2.4, y: 1.6, z: 3.6 }, to: { x: 8, y: 0.9, z: 1.2 } },
    },
    {
      floor: "ground",
      room: "escalera",
      line: "Una escalera en U, en el mismo hueco en cada planta, de la entrada a la azotea.",
      view: { from: { x: 1.55, y: 1.6, z: -1.35 }, to: { x: 1.55, y: 3, z: -5.6 } },
    },
    {
      floor: "first",
      room: "suite",
      line: "Vuela sobre el porche: se despierta frente a la piscina y el Mediterráneo.",
      view: { from: { x: -6, y: 1.6, z: 4 }, to: { x: -6, y: 1.2, z: 12 } },
    },
  ],
  floors: [
    {
      id: "plot",
      name: "Exterior",
      kind: "plot",
      rooms: [
        {
          id: "jardin",
          name: "Jardín",
          kind: "garden",
          x: -14,
          z: -10,
          w: 26,
          d: 23,
          orientation: "Sur",
          open: true,
          // 598 m² of plot less the house (158), the porch (32), the terrace (30), the pool (48)
          // and the loungers (14).
          area: 316,
        },
        {
          id: "porche",
          name: "Porche",
          kind: "deck",
          x: -10,
          z: 5,
          w: 8,
          d: 4,
          orientation: "Sur",
          open: true,
          furniture: [
            // Round a low table in front of the sofa, two lounge chairs; olive pots at the far corners.
            { piece: "round-coffee-table", x: -6, z: 7.2, facing: "south" },
            { piece: "lounge-chair", x: -7.6, z: 8.3, facing: "north" },
            { piece: "lounge-chair", x: -4.4, z: 8.3, facing: "north" },
            { piece: "vase", x: -6.2, z: 7.1, y: 0.49, facing: "south" },
            { piece: "plant", x: -9.6, z: 8.55, facing: "east" },
            { piece: "plant", x: -2.45, z: 8.55, facing: "west" },
          ],
        },
        {
          id: "terraza-cocina",
          name: "Terraza",
          kind: "patio",
          x: -2,
          z: 5,
          w: 10,
          d: 3,
          orientation: "Sur",
          open: true,
        },
        {
          id: "piscina",
          name: "Piscina",
          kind: "pool",
          x: -9,
          z: 9.8,
          w: 16,
          d: 3,
          orientation: "Sur",
          open: true,
        },
        {
          id: "hamacas",
          name: "Zona de hamacas",
          kind: "solarium",
          x: 7.5,
          z: 9.3,
          w: 4,
          d: 3.5,
          orientation: "Sur",
          open: true,
          // From the far corner of the loungers, back over the pool to the house.
          view: { from: { x: 11.2, y: 1.6, z: 12.4 }, to: { x: 0, y: 1.5, z: 4 } },
        },
      ],
      openings: [],
    },
    {
      id: "ground",
      name: "Planta baja",
      kind: "storey",
      rooms: [
        {
          id: "recibidor",
          name: "Recibidor",
          kind: "hall",
          x: -2,
          z: -6,
          w: 3,
          d: 5,
          orientation: "Norte",
          furniture: [
            // An oak console along the wall to the stair, a plant against the glass to the patio.
            { piece: "sideboard", x: 0.74, z: -3.12, facing: "west" },
            { piece: "vase", x: 0.74, z: -3.8, y: 0.68, facing: "west" },
            { piece: "succulent", x: 0.74, z: -2.5, y: 0.68, facing: "west" },
            { piece: "plant", x: -1.6, z: -2.4, facing: "east" },
          ],
        },
        {
          id: "escalera",
          name: "Escalera",
          kind: "stair",
          x: 1,
          z: -6,
          w: 2.2,
          d: 5,
          orientation: "Norte",
        },
        {
          id: "aseo",
          name: "Aseo",
          kind: "toilet",
          x: 3.2,
          z: -6,
          w: 2.2,
          d: 1.8,
          orientation: "Norte",
          // From the door's corner across to the far one, its basin and toilet along the walls.
          view: { from: { x: 3.45, y: 1.6, z: -4.45 }, to: { x: 5.3, y: 0.8, z: -5.9 } },
        },
        {
          id: "lavadero",
          name: "Lavadero",
          kind: "utility",
          x: 3.2,
          z: -4.2,
          w: 2.2,
          d: 3.2,
          orientation: "Norte",
          // Corner to corner, along its worktop.
          view: { from: { x: 5.1, y: 1.6, z: -1.3 }, to: { x: 3.4, y: 0.9, z: -4 } },
        },
        {
          id: "estudio",
          name: "Estudio",
          kind: "study",
          x: 5.4,
          z: -6,
          w: 2.6,
          d: 5,
          orientation: "Este",
        },
        {
          id: "salon",
          name: "Salón",
          kind: "living",
          x: -10,
          z: -1,
          w: 7,
          d: 6,
          orientation: "Suroeste",
          furniture: [
            // Across the low table from the sofa, two armchairs; cushions on the sofa.
            { piece: "coffee-table", x: -6.5, z: 0.9, facing: "south" },
            { piece: "vase", x: -6.8, z: 0.9, y: 0.39, facing: "south" },
            { piece: "armchair", x: -7.5, z: 2.6, facing: "north" },
            { piece: "armchair", x: -5.5, z: 2.6, facing: "north" },
            { piece: "side-table", x: -8.3, z: -0.6, facing: "south" },
            { piece: "cushions", x: -6.5, z: -0.45, y: 0.42, facing: "south" },
          ],
        },
        {
          id: "comedor",
          name: "Comedor",
          kind: "dining",
          x: -3,
          z: -1,
          w: 4.5,
          d: 6,
          orientation: "Sur",
          furniture: [
            // A lamp over the table, a vase on it.
            { piece: "pendant", x: -0.75, z: 1.3, y: 1.95, facing: "south" },
            { piece: "vase", x: -0.75, z: 1.3, y: 0.75, facing: "south" },
          ],
        },
        {
          id: "cocina",
          name: "Cocina",
          kind: "kitchen",
          x: 1.5,
          z: -1,
          w: 6.5,
          d: 6,
          orientation: "Sureste",
          furniture: [
            // Two lamps over the island.
            { piece: "pendant", x: 5.9, z: 1.4, y: 1.95, facing: "south" },
            { piece: "pendant", x: 5.9, z: 2.6, y: 1.95, facing: "south" },
            { piece: "succulent", x: 5.9, z: 2, y: 0.9, facing: "south" },
          ],
        },
      ],
      openings: [
        {
          kind: "entrance",
          room: "recibidor",
          side: "north",
          at: -0.5,
          width: 1.2,
          opens: "in",
          hinge: "east",
        },
        // A pane of glass beside the door, and the hall's wall to the entrance patio in glass.
        { kind: "window", room: "recibidor", side: "north", at: 0.55, width: 0.7, sill: 0 },
        { kind: "window", room: "recibidor", side: "west", at: -3.5, width: 3, sill: 0 },
        { kind: "passage", room: "recibidor", side: "south", at: -0.5, width: 2 },
        { kind: "passage", room: "recibidor", side: "east", at: -1.45, width: 0.9 },
        { kind: "passage", room: "salon", side: "east", at: 2, width: 5.6 },
        { kind: "passage", room: "comedor", side: "east", at: 2, width: 5.6 },
        {
          kind: "door",
          room: "lavadero",
          side: "south",
          at: 4.3,
          width: 0.8,
          opens: "out",
          hinge: "west",
        },
        {
          kind: "door",
          room: "aseo",
          side: "south",
          at: 4.3,
          width: 0.7,
          opens: "out",
          hinge: "east",
        },
        {
          kind: "door",
          room: "estudio",
          side: "south",
          at: 6.7,
          width: 0.9,
          opens: "out",
          hinge: "east",
        },
        // The day wing, all glass to the garden and the pool.
        { kind: "sliding", room: "salon", side: "south", at: -6.5, width: 6 },
        { kind: "sliding", room: "salon", side: "west", at: 2, width: 5 },
        { kind: "window", room: "salon", side: "north", at: -6.5, width: 5, sill: 0.1 },
        { kind: "sliding", room: "comedor", side: "south", at: -0.75, width: 4 },
        { kind: "sliding", room: "cocina", side: "south", at: 4.75, width: 5 },
        { kind: "window", room: "cocina", side: "east", at: 2, width: 4, sill: 0.9 },
        { kind: "window", room: "estudio", side: "east", at: -3.5, width: 3, sill: 0.5 },
        { kind: "window", room: "estudio", side: "north", at: 6.7, width: 1.6, sill: 0.9 },
        { kind: "window", room: "aseo", side: "north", at: 4.3, width: 0.6, sill: 1.6 },
      ],
      // The kitchen's terrace under a white frame, one of two stacked over it.
      canopies: [{ kind: "eave", x: 1.5, z: 5, w: 6.5, d: 2.5 }],
    },
    {
      id: "first",
      name: "Primera planta",
      kind: "storey",
      rooms: [
        {
          id: "escalera",
          name: "Escalera",
          kind: "stair",
          x: 1,
          z: -6,
          w: 2.2,
          d: 5,
          orientation: "Norte",
          // Up the next flight, to the roof.
          view: { from: { x: 1.55, y: 1.6, z: -1.35 }, to: { x: 1.55, y: 3, z: -5.6 } },
        },
        {
          id: "bano-2",
          name: "Baño 2",
          kind: "bath",
          x: -2,
          z: -6,
          w: 3,
          d: 5,
          orientation: "Norte",
          // From beside its door, across to the bath under the high window.
          view: { from: { x: 0.7, y: 1.6, z: -1.3 }, to: { x: -1.8, y: 0.9, z: -5.8 } },
        },
        {
          id: "dormitorio-2",
          name: "Dormitorio 2",
          kind: "bedroom",
          x: 3.2,
          z: -6,
          w: 4.8,
          d: 5,
          orientation: "Norte",
          wardrobe: { x: 7.4, z: -5.4, w: 0.6, d: 3.4 },
        },
        {
          id: "galeria",
          name: "Galería",
          kind: "corridor",
          x: -2,
          z: -1,
          w: 10,
          d: 2,
          orientation: "Este",
          furniture: [
            // Shelves along the glass, a plant at the window to the east.
            { piece: "shelves", x: 6.9, z: 0.8, facing: "north" },
            { piece: "plant", x: 7.6, z: -0.6, facing: "west" },
          ],
        },
        {
          id: "dormitorio-3",
          name: "Dormitorio 3",
          kind: "bedroom",
          x: 1,
          z: 1,
          w: 7,
          d: 4,
          orientation: "Sureste",
          wardrobe: { x: 1, z: 1.6, w: 0.6, d: 2.8 },
        },
        {
          id: "terraza",
          name: "Terraza",
          kind: "terrace",
          x: -2,
          z: 1,
          w: 3,
          d: 4,
          orientation: "Sur",
          open: true,
          // Out to the pool and the sea, under the frame.
          view: { from: { x: -0.5, y: 1.6, z: 1.4 }, to: { x: -0.5, y: 1.2, z: 12 } },
        },
        {
          id: "vestidor",
          name: "Vestidor",
          kind: "dressing",
          x: -6,
          z: -1,
          w: 4,
          d: 3.5,
          orientation: "Norte",
          // From the suite's doorway, back along its units to the gallery.
          view: { from: { x: -4, y: 1.6, z: 2.15 }, to: { x: -5.6, y: 1.1, z: -0.7 } },
        },
        {
          id: "bano-suite",
          name: "Baño de la suite",
          kind: "bath",
          x: -10,
          z: -1,
          w: 4,
          d: 3.5,
          orientation: "Oeste",
          // From the dressing room's side, across to the high windows.
          view: { from: { x: -6.3, y: 1.6, z: 2.2 }, to: { x: -9.8, y: 0.9, z: -0.8 } },
        },
        {
          id: "suite",
          name: "Suite principal",
          kind: "bedroom",
          x: -10,
          z: 2.5,
          w: 8,
          d: 6.5,
          orientation: "Sur",
          furniture: [
            // Bedside tables and cushions at the bed; a reading corner at the west window; a sideboard to the east.
            { piece: "nightstand", x: -7.15, z: 2.8, facing: "south" },
            { piece: "nightstand", x: -4.88, z: 2.8, facing: "south" },
            { piece: "cushions", x: -6, z: 2.85, y: 0.52, facing: "south" },
            { piece: "lounge-chair", x: -9.3, z: 7.6, facing: "east" },
            { piece: "side-table", x: -9.5, z: 6.3, facing: "east" },
            { piece: "sideboard", x: -2.26, z: 7, facing: "west" },
            { piece: "plant", x: -2.45, z: 5.3, facing: "west" },
          ],
        },
      ],
      openings: [
        { kind: "passage", room: "escalera", side: "south", at: 2.4, width: 1.6 },
        {
          kind: "door",
          room: "bano-2",
          side: "south",
          at: -0.5,
          width: 0.8,
          opens: "in",
          hinge: "west",
        },
        {
          kind: "door",
          room: "dormitorio-2",
          side: "south",
          at: 5.6,
          width: 0.9,
          opens: "in",
          hinge: "east",
        },
        {
          kind: "door",
          room: "dormitorio-3",
          side: "north",
          at: 4.5,
          width: 0.9,
          opens: "in",
          hinge: "east",
        },
        { kind: "sliding", room: "galeria", side: "south", at: -0.5, width: 2.4 },
        {
          kind: "door",
          room: "vestidor",
          side: "east",
          at: 0,
          width: 0.9,
          opens: "in",
          hinge: "north",
        },
        { kind: "passage", room: "vestidor", side: "west", at: 1, width: 0.9 },
        { kind: "passage", room: "vestidor", side: "south", at: -4, width: 1.2 },
        // The suite at the tip of the overhang: glass on three sides.
        { kind: "sliding", room: "suite", side: "south", at: -6, width: 6 },
        { kind: "window", room: "suite", side: "west", at: 5.75, width: 5, sill: 0.1 },
        { kind: "sliding", room: "suite", side: "east", at: 3.75, width: 2 },
        { kind: "window", room: "suite", side: "east", at: 7, width: 3, sill: 0.1 },
        { kind: "window", room: "bano-suite", side: "north", at: -8, width: 2, sill: 1.6 },
        { kind: "window", room: "bano-suite", side: "west", at: 0.75, width: 1.2, sill: 1.6 },
        { kind: "window", room: "dormitorio-2", side: "north", at: 5.6, width: 3, sill: 0.5 },
        { kind: "window", room: "dormitorio-2", side: "east", at: -3.5, width: 2.4, sill: 0.5 },
        { kind: "window", room: "bano-2", side: "north", at: -0.5, width: 1.6, sill: 1.6 },
        { kind: "sliding", room: "dormitorio-3", side: "south", at: 4.5, width: 5 },
        { kind: "window", room: "dormitorio-3", side: "east", at: 3, width: 2.4, sill: 0.5 },
        { kind: "window", room: "galeria", side: "east", at: 0, width: 1.4, sill: 0.3 },
      ],
      // A white frame over the terrace, and over the bedrooms' front, flying past it.
      canopies: [
        { kind: "eave", x: -2, z: 1, w: 3, d: 4 },
        { kind: "eave", x: -2, z: 5, w: 10, d: 2.5 },
      ],
    },
    {
      id: "roof",
      name: "Azotea",
      kind: "roof",
      rooms: [
        {
          id: "caseton",
          name: "Escalera",
          kind: "stair",
          x: 1,
          z: -6,
          w: 2.2,
          d: 5,
          orientation: "Norte",
        },
        {
          id: "aromaticas",
          name: "Jardín de aromáticas",
          kind: "planter",
          x: -2,
          z: -6,
          w: 3,
          d: 5,
          orientation: "Norte",
          open: true,
          // Over the planters to the solarium and the sea.
          view: { from: { x: 0.7, y: 1.6, z: -5.7 }, to: { x: -6, y: 1, z: 4 } },
        },
        {
          id: "pasarela",
          name: "Pasarela",
          kind: "deck",
          x: -2,
          z: -1,
          w: 5.2,
          d: 2,
          orientation: "Sur",
          open: true,
          // Along the walkway to the solarium, the sea beyond.
          view: { from: { x: 2.9, y: 1.6, z: 0 }, to: { x: -9, y: 1.2, z: 3 } },
        },
        {
          id: "solarium",
          name: "Solárium",
          kind: "solarium",
          x: -10,
          z: -1,
          w: 8,
          d: 10,
          orientation: "Sur",
          open: true,
        },
        {
          id: "chill-out",
          name: "Zona chill-out",
          kind: "lounge",
          x: 3.2,
          z: -6,
          w: 4.8,
          d: 11,
          orientation: "Sureste",
          open: true,
          furniture: [
            // Under the pergola, armchairs round a low table; plants along the parapet.
            { piece: "round-coffee-table", x: 5.6, z: 2.5, facing: "south" },
            { piece: "armchair", x: 4.2, z: 2.5, facing: "east" },
            { piece: "armchair", x: 7.1, z: 2.5, facing: "west" },
            { piece: "plant", x: 7.5, z: -5.5, facing: "south" },
            { piece: "plant", x: 7.5, z: -3.8, facing: "south" },
            { piece: "plant", x: 3.7, z: 4.5, facing: "east" },
          ],
        },
      ],
      openings: [
        {
          kind: "door",
          room: "caseton",
          side: "east",
          at: -2,
          width: 0.9,
          opens: "out",
          hinge: "south",
        },
      ],
      canopies: [{ kind: "pergola", x: 3.2, z: 0, w: 4.8, d: 5 }],
    },
  ],
} satisfies HousePlan;
