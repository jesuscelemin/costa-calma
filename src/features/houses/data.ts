import { planFigures } from "./plan.ts";
import { casaOlivoPlan } from "./plans/casa-olivo.ts";
import { casaPinarPlan } from "./plans/casa-pinar.ts";
import { villaDunaBlancaPlan } from "./plans/villa-duna-blanca.ts";
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
      slug: "villa-duna-blanca",
      name: "Villa Duna Blanca",
      title: { lead: "Villa Duna", accent: "Blanca" },
      kind: "Villa independiente en primera línea",
      statement: {
        lead: "Travertino, nogal y vidrio",
        rest: "frente al mar: un porche a doble altura sobre la piscina infinity y una azotea con jacuzzi.",
      },
      description:
        "Villa independiente en primera línea de playa: cuatro suites, gimnasio y spa, ascensor, escalera flotante, porche a doble altura, piscina infinity con jacuzzi y una azotea con cocina exterior, fuego y jacuzzi frente al Mediterráneo.",
      sheetHeading: {
        lead: "De la verja al",
        accent: "mar",
        line: "Entre dos láminas de agua, del vestíbulo al porche de doble altura y la piscina.",
      },
      hasTour: true,
      ...fromPlan(villaDunaBlancaPlan),
    },
    {
      slug: "casa-pinar",
      name: "Casa Pinar",
      title: { lead: "Casa", accent: "Pinar" },
      kind: "Pareada con azotea",
      statement: {
        lead: "Dos plantas y una azotea",
        rest: "en lo alto de la colina, con la piscina detrás y el mar por delante, por encima de los tejados.",
      },
      description:
        "Vivienda pareada de dos plantas y azotea en segunda línea, en travertino y nogal: salón y suite al mar, cocina abierta a la piscina, tres dormitorios y un solárium con pérgola.",
      sheetHeading: {
        lead: "De la calle al",
        accent: "mar",
        line: "Se entra desde el sur, junto al coche; el salón y la suite miran al mar.",
      },
      hasTour: true,
      ...fromPlan(casaPinarPlan),
    },
    {
      slug: "casa-olivo",
      name: "Casa Olivo",
      title: { lead: "Casa", accent: "Olivo" },
      kind: "Una planta en torno a un olivo",
      statement: {
        lead: "Todo en una planta,",
        rest: "alrededor de un patio con un olivo, con la piscina detrás y un solárium sobre el salón para ver el mar.",
      },
      description:
        "Vivienda de una planta en U alrededor de un patio con un olivo, en travertino y nogal: salón acristalado al mar y al patio, tres dormitorios con su baño, piscina y solárium.",
      sheetHeading: {
        lead: "Alrededor del",
        accent: "olivo",
        line: "Una planta en U, abierta al norte a su patio y al sur al mar.",
      },
      hasTour: true,
      ...fromPlan(casaOlivoPlan),
    },
  ],
  // The 12 units of the development: 4 Villa Duna Blanca on the front line, 4 Casa Pinar (2 semi-detached
  // pairs: 5–6 and 7–8) and 4 Casa Olivo.
  units: [
    { number: 1, houseType: "villa-duna-blanca", price: 2450000, status: "available" },
    { number: 2, houseType: "villa-duna-blanca", price: 2550000, status: "reserved" },
    { number: 3, houseType: "villa-duna-blanca", price: 2650000, status: "available" },
    { number: 4, houseType: "villa-duna-blanca", price: 2900000, status: "sold" },
    { number: 5, houseType: "casa-pinar", price: 1120000, status: "sold" },
    { number: 6, houseType: "casa-pinar", price: 1120000, status: "available" },
    { number: 7, houseType: "casa-pinar", price: 1160000, status: "reserved" },
    { number: 8, houseType: "casa-pinar", price: 1160000, status: "sold" },
    { number: 9, houseType: "casa-olivo", price: 980000, status: "sold" },
    { number: 10, houseType: "casa-olivo", price: 995000, status: "sold" },
    { number: 11, houseType: "casa-olivo", price: 1010000, status: "reserved" },
    { number: 12, houseType: "casa-olivo", price: 1030000, status: "sold" },
  ],
});
