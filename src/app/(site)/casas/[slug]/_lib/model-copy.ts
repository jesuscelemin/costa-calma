import { planFigures } from "@/features/houses/plan";
import type { HousePlan } from "@/features/houses/schema";
import { formatArea } from "@/lib/format";

import type { ModelPhase } from "./model-choreography";

export type ModelChapterCopy = {
  label: string;
  /** The title, ending on its accent word. */
  title: { lead: string; accent: string };
  text: string;
};

/** What the text beside the model says in each phase, from the plan it builds. */
export function modelCopy(plan: HousePlan): Record<ModelPhase, ModelChapterCopy> {
  const { plotArea } = planFigures(plan);
  const plot = plan.floors.find(({ kind }) => kind === "plot");
  const pool = plot?.rooms.some(({ kind }) => kind === "pool") ?? false;
  const storeys = plan.floors.filter(({ kind }) => kind === "storey");
  const roof = plan.floors.some(({ kind }) => kind === "roof");

  return {
    plot: {
      label: "La parcela",
      title: { lead: "Empieza en", accent: "el terreno" },
      text: `${formatArea(plotArea)} junto al mar, con sus pinos${pool ? " y el hueco de la piscina" : ""}.`,
    },
    plan: {
      label: "El replanteo",
      title: { lead: "Se dibuja", accent: "en el suelo" },
      text: "El plano de la planta baja, en tinta y a escala: sus muros, sus ventanas y el arco de cada puerta.",
    },
    walls: {
      label: "Los muros",
      title: { lead: "Suben", accent: "los muros" },
      text: `Con sus huecos reales: puertas, ventanas y correderas al sur${pool ? ", mientras la piscina se llena" : ""}.`,
    },
    storeys: {
      label: "Las plantas",
      title: { lead: "Planta", accent: "sobre planta" },
      text:
        storeys.length > 1
          ? `Cada planta se construye sobre la de abajo${roof ? ", hasta la azotea" : ""}.`
          : "La azotea se construye sobre la planta baja.",
    },
    open: {
      label: "La casa abierta",
      title: { lead: "Se abre", accent: "en el aire" },
      text: "Las plantas se separan con las luces encendidas, para ver cada una por dentro.",
    },
  };
}
