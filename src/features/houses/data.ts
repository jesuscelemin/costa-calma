import { planFigures } from "./plan.ts";
import { casaDunaPlan } from "./plans/casa-duna.ts";
import { casaPinarPlan } from "./plans/casa-pinar.ts";
import { villaMarPlan } from "./plans/villa-mar.ts";
import { catalogDataSchema, type HousePlan } from "./schema.ts";

// The one place to edit the house types and units: copy, figures, prices and statuses. Read it
// only through catalog.ts. In Phase 5 this becomes the database seed. Draft proposed by Claude
// for Jesús to edit; prices are in euros and areas in m². Each house type takes its floors and
// figures from its plan (plans/), so they never disagree with its rooms.

const fromPlan = (plan: HousePlan) => ({
  plan,
  figures: planFigures(plan),
  floors: plan.floors.map(({ id, name, kind }) => ({ id, name, kind })),
});

export const catalogData = catalogDataSchema.parse({
  houseTypes: [
    {
      slug: "villa-mar",
      name: "Villa Mar",
      title: { lead: "Villa", accent: "Mar" },
      kind: "Villa independiente con piscina",
      statement: {
        lead: "Una planta alta que vuela",
        rest: "sobre el porche hacia la piscina, un salón de vidrio de suelo a techo y una azotea frente al mar.",
      },
      description:
        "Villa independiente en primera línea: volúmenes blancos, planta baja acristalada, una suite que vuela sobre el porche, azotea, piscina de 16 m y jardín. La más amplia de Costa Calma.",
      sheetHeading: {
        lead: "De la puerta al",
        accent: "mar",
        line: "En línea recta, de la puerta norte a la piscina.",
      },
      hasTour: true,
      ...fromPlan(villaMarPlan),
    },
    {
      slug: "casa-pinar",
      name: "Casa Pinar",
      title: { lead: "Casa", accent: "Pinar" },
      kind: "Pareada con jardín",
      statement: {
        lead: "Dos plantas entre pinos,",
        rest: "con un patio de entrada, jardín privado y una terraza con pérgola para las tardes largas.",
      },
      description:
        "Vivienda pareada de dos plantas con patio de entrada, jardín privado, porche y terraza con pérgola, a la sombra de los pinos.",
      sheetHeading: {
        lead: "Del patio al",
        accent: "jardín",
        line: "Bajo el vuelo de la planta alta, del patio del pino al jardín del sur.",
      },
      hasTour: true,
      ...fromPlan(casaPinarPlan),
    },
    {
      slug: "casa-duna",
      name: "Casa Duna",
      title: { lead: "Casa", accent: "Duna" },
      kind: "Planta baja en torno a un patio",
      statement: {
        lead: "Todo en una planta,",
        rest: "alrededor de un patio con un olivo, a un paseo corto de la arena.",
      },
      description:
        "Vivienda de una sola planta en U alrededor de un patio con un olivo, con porche y jardín, sin escaleras y a un paso de la playa.",
      sheetHeading: {
        lead: "Alrededor del",
        accent: "olivo",
        line: "Una sola planta en U, abierta al sur alrededor de su patio.",
      },
      hasTour: true,
      ...fromPlan(casaDunaPlan),
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
