import { catalogDataSchema } from "./schema.ts";

// The one place to edit the house types and units: copy, figures, prices and statuses. Read it
// only through catalog.ts. In Phase 5 this becomes the database seed. Draft proposed by Claude
// for Jesús to edit; prices are in euros and areas in m².

export const catalogData = catalogDataSchema.parse({
  houseTypes: [
    {
      slug: "villa-mar",
      name: "Villa Mar",
      title: { lead: "Villa", accent: "Mar" },
      kind: "Villa independiente con piscina",
      statement: {
        lead: "Dos plantas y una azotea",
        rest: "que miran al mar, con piscina propia y el salón abierto al jardín del sur.",
      },
      description:
        "Villa independiente en primera línea, con azotea, piscina y jardín. La más amplia de Costa Calma.",
      figures: { builtArea: 240, plotArea: 462, bedrooms: 4, bathrooms: 3 },
      hasTour: true,
      floors: [
        { id: "plot", name: "Exterior", kind: "plot" },
        { id: "ground", name: "Planta baja", kind: "storey" },
        { id: "first", name: "Primera planta", kind: "storey" },
        { id: "roof", name: "Azotea", kind: "roof" },
      ],
    },
    {
      slug: "casa-pinar",
      name: "Casa Pinar",
      title: { lead: "Casa", accent: "Pinar" },
      kind: "Pareada con jardín",
      statement: {
        lead: "Dos plantas entre pinos",
        rest: "con jardín privado y un porche para las tardes largas.",
      },
      description:
        "Vivienda pareada de dos plantas con jardín privado y porche, a la sombra de los pinos.",
      figures: { builtArea: 165, plotArea: 285, bedrooms: 3, bathrooms: 2 },
      hasTour: false,
      floors: [
        { id: "plot", name: "Exterior", kind: "plot" },
        { id: "ground", name: "Planta baja", kind: "storey" },
        { id: "first", name: "Primera planta", kind: "storey" },
      ],
    },
    {
      slug: "casa-duna",
      name: "Casa Duna",
      title: { lead: "Casa", accent: "Duna" },
      kind: "Planta baja con jardín y porche",
      statement: {
        lead: "Todo en una planta,",
        rest: "con porche y jardín, a un paseo corto de la arena.",
      },
      description:
        "Vivienda de una sola planta con porche y jardín, sin escaleras y a un paso de la playa.",
      figures: { builtArea: 118, plotArea: 340, bedrooms: 3, bathrooms: 2 },
      hasTour: false,
      floors: [
        { id: "plot", name: "Exterior", kind: "plot" },
        { id: "ground", name: "Planta baja", kind: "storey" },
      ],
    },
  ],
  // The 12 units of the development: 4 Villa Mar on the front line, 4 Casa Pinar (2 semi-detached
  // pairs: 5–6 and 7–8) and 4 Casa Duna.
  units: [
    { number: 1, houseType: "villa-mar", price: 685000, status: "available" },
    { number: 2, houseType: "villa-mar", price: 695000, status: "reserved" },
    { number: 3, houseType: "villa-mar", price: 710000, status: "available" },
    { number: 4, houseType: "villa-mar", price: 735000, status: "sold" },
    { number: 5, houseType: "casa-pinar", price: 465000, status: "sold" },
    { number: 6, houseType: "casa-pinar", price: 465000, status: "available" },
    { number: 7, houseType: "casa-pinar", price: 479000, status: "reserved" },
    { number: 8, houseType: "casa-pinar", price: 479000, status: "sold" },
    { number: 9, houseType: "casa-duna", price: 389000, status: "sold" },
    { number: 10, houseType: "casa-duna", price: 395000, status: "sold" },
    { number: 11, houseType: "casa-duna", price: 399000, status: "reserved" },
    { number: 12, houseType: "casa-duna", price: 405000, status: "sold" },
  ],
});
