import { floorArea, floorGeometry, planFigures } from "@/features/houses/plan";
import type { HousePlan } from "@/features/houses/schema";
import { formatArea, formatLength, formatNumber } from "@/lib/format";

import type { ModelPhase } from "./model-choreography";

export type ModelChapterCopy = {
  label: string;
  /** A figure of what the phase shows: "462 m²", "8". */
  figure: string;
  /** The line under it, which ends its sentence: "de parcela, con una piscina…". */
  text: string;
};

const listFormat = new Intl.ListFormat("es", { type: "conjunction" });

/** "1 baño", "3 baños". */
const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * What the text beside the model says in each phase: the house's real figures, from the plan it
 * builds, adding up as the house goes up.
 */
export function modelCopy(plan: HousePlan): Record<ModelPhase, ModelChapterCopy> {
  const { plotArea, builtArea, bedrooms, bathrooms, toilets } = planFigures(plan);
  const pool = plan.floors
    .find(({ kind }) => kind === "plot")
    ?.rooms.find(({ kind }) => kind === "pool");
  const storeys = plan.floors.filter(({ kind }) => kind === "storey");
  const ground = storeys[0];
  const roof = plan.floors.find(({ kind }) => kind === "roof");
  const groundRooms = ground?.rooms.filter(({ kind }) => kind !== "void").length ?? 0;
  const openings = ground ? floorGeometry(ground, plan).openings : [];
  const windows = openings.filter(({ kind }) => kind === "window" || kind === "sliding");
  const sliding = windows.filter(({ kind }) => kind === "sliding").length;

  return {
    plot: {
      label: "La parcela",
      figure: formatArea(plotArea),
      text: pool
        ? `de parcela, con una piscina de ${formatNumber(pool.w)} × ${formatLength(pool.d)}`
        : "de parcela",
    },
    plan: {
      label: "El replanteo",
      figure: formatArea(ground ? floorArea(ground) : 0),
      text: `en planta baja, en ${groundRooms} estancias`,
    },
    walls: {
      label: "Los muros",
      figure: String(windows.length),
      text: `ventanas en planta baja${sliding ? `, ${sliding} de ellas correderas` : ""}`,
    },
    storeys: {
      label: "Las plantas",
      figure: formatArea(builtArea),
      text: [
        `construidos en ${storeys.length === 1 ? "una planta" : `${storeys.length} plantas`}`,
        ...(roof ? [`con una azotea de ${formatArea(floorArea(roof))}`] : []),
      ].join(", "),
    },
    open: {
      label: "La casa abierta",
      figure: String(bedrooms),
      text: listFormat.format([
        bedrooms === 1 ? "dormitorio" : "dormitorios",
        count(bathrooms, "baño", "baños"),
        ...(toilets ? [count(toilets, "aseo", "aseos")] : []),
      ]),
    },
  };
}
