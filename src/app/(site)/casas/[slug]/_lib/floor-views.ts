import {
  floorArea,
  floorGeometry,
  houseBounds,
  overhangs,
  planFigures,
  stairEntry,
  type WallSegment,
} from "@/features/houses/plan";
import type { HousePlan, Orientation, Side } from "@/features/houses/schema";
import { formatArea } from "@/lib/format";

import type { PlanFloorView } from "../_components/FloorPlanViewer";

const COMPASS: Record<Side, Lowercase<Orientation>> = {
  north: "norte",
  south: "sur",
  east: "este",
  west: "oeste",
};

const listFormat = new Intl.ListFormat("es", { type: "conjunction" });

/** A floor's outline: the walls and railings that close it to the outside. */
const outerWalls = ({ walls }: { walls: WallSegment[] }) =>
  walls.filter(({ kind }) => kind !== "interior");

/** Each floor of a plan as its 2D plan draws it, and the rectangle that frames every storey. */
export function floorViews(plan: HousePlan) {
  const { plotArea } = planFigures(plan);
  const bounds = houseBounds(plan);
  const party = plan.partyWall ? [`medianera al ${COMPASS[plan.partyWall]}`] : [];
  const storeys = plan.floors.filter(({ kind }) => kind === "storey");
  const ground = storeys[0];
  const floors = plan.floors.map((floor, index): PlanFloorView => {
    const geometry = floorGeometry(floor, plan);
    const next = plan.floors[index + 1];
    // From the plot, the storeys over the ground floor and the ground floor's own shades; from a
    // storey, the storey above. The drawing shows them only where they reach past the floor.
    const upper = floor.kind === "plot" ? storeys.slice(1) : next?.kind === "storey" ? [next] : [];
    const under = (floor.kind === "plot" ? ground?.rooms : floor.rooms) ?? [];
    const above = upper.flatMap((storey) => outerWalls(floorGeometry(storey, plan)));
    const overhang = upper.some((storey) => overhangs(storey.rooms, under));
    const canopies = (floor.kind === "plot" ? ground?.canopies : floor.canopies) ?? [];
    const dashed = [
      ...(overhang ? ["la planta de arriba, que vuela"] : []),
      ...(canopies.some(({ kind }) => kind === "eave") ? ["el alero"] : []),
      ...(canopies.some(({ kind }) => kind === "pergola") ? ["la pérgola"] : []),
    ];
    const rooms = geometry.rooms.filter(({ kind }) => kind !== "void");
    return {
      id: floor.id,
      name: floor.name,
      kind: floor.kind,
      geometry,
      frame: floor.kind === "plot" ? plan.plot : bounds,
      house:
        floor.kind === "plot" && ground
          ? { rooms: ground.rooms, walls: outerWalls(floorGeometry(ground, plan)) }
          : undefined,
      above,
      under,
      canopies,
      summary: [
        floor.kind === "plot"
          ? `Parcela de ${formatArea(plotArea)}`
          : `${formatArea(floorArea(floor))} en ${rooms.length} estancias`,
        ...party,
        ...(dashed.length ? [`en discontinuo, ${listFormat.format(dashed)}`] : []),
      ].join(" · "),
      stairEntry: stairEntry(floor),
    };
  });
  const firstStorey = plan.floors.find(({ kind }) => kind === "storey") ?? plan.floors[0]!;
  return { floors, bounds, firstStorey: firstStorey.id };
}
