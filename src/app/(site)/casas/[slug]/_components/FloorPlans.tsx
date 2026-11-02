import type { CatalogHouseType } from "@/features/houses/catalog";
import { floorArea, floorGeometry, planFigures, stairEntry } from "@/features/houses/plan";
import type { Orientation, Side } from "@/features/houses/schema";
import { formatArea } from "@/lib/format";

import { FloorPlanViewer, type PlanFloorView } from "./FloorPlanViewer";

const COMPASS: Record<Side, Lowercase<Orientation>> = {
  north: "norte",
  south: "sur",
  east: "este",
  west: "oeste",
};

type FloorPlansProps = {
  houseType: CatalogHouseType;
};

/**
 * The plan of each floor, drawn from the same data as the house's figures: buttons to pick a
 * floor, its plan and its rooms with their m² and orientation. The model's accessible
 * alternative, and the plan as a visitor reads it before the 3D.
 */
export function FloorPlans({ houseType: { plan, name } }: FloorPlansProps) {
  const { plotArea } = planFigures(plan);
  const party = plan.partyWall ? [`medianera al ${COMPASS[plan.partyWall]}`] : [];
  const floors = plan.floors.map((floor): PlanFloorView => {
    const geometry = floorGeometry(floor, plan);
    return {
      id: floor.id,
      name: floor.name,
      kind: floor.kind,
      geometry,
      frame: floor.kind === "plot" ? plan.plot : plan.footprint,
      summary: [
        floor.kind === "plot"
          ? `Parcela de ${formatArea(plotArea)}`
          : `${formatArea(floorArea(floor))} en ${geometry.rooms.length} estancias`,
        ...party,
      ].join(" · "),
      stairEntry: stairEntry(floor),
    };
  });
  const firstStorey = plan.floors.find(({ kind }) => kind === "storey") ?? plan.floors[0]!;

  return (
    // aria-label, not aria-labelledby: the title's hidden moving copy would be read twice.
    <section aria-label={`Planos de ${name}`} className="mx-auto w-full max-w-7xl px-6 md:px-10">
      <FloorPlanViewer
        floors={floors}
        footprint={plan.footprint}
        partyWall={plan.partyWall}
        initialFloor={firstStorey.id}
      />
    </section>
  );
}
