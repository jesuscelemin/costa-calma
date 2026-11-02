import type { CatalogHouseType } from "@/features/houses/catalog";
import { floorGeometry } from "@/features/houses/plan";
import { formatArea } from "@/lib/format";

import { FloorPlanViewer, type PlanFloorView } from "./FloorPlanViewer";

type FloorPlansProps = {
  houseType: CatalogHouseType;
};

/**
 * The plan of each floor, drawn from the same data as the house's figures: buttons to pick a
 * floor, its plan and its rooms with their m² and orientation. The model's accessible
 * alternative, and the plan as a visitor reads it before the 3D. Only house types with a plan.
 */
export function FloorPlans({ houseType: { plan, name } }: FloorPlansProps) {
  if (!plan) return null;

  const floors = plan.floors.map((floor): PlanFloorView => {
    const geometry = floorGeometry(floor);
    const indoor = geometry.rooms.reduce((sum, room) => sum + room.area, 0);
    return {
      id: floor.id,
      name: floor.name,
      kind: floor.kind,
      geometry,
      frame: floor.kind === "plot" ? plan.plot : plan.footprint,
      summary:
        floor.kind === "plot"
          ? `Parcela de ${formatArea(plan.plot.w * plan.plot.d)}`
          : `${formatArea(Math.round(indoor * 100) / 100)} en ${geometry.rooms.length} estancias`,
    };
  });
  const firstStorey = plan.floors.find(({ kind }) => kind === "storey") ?? plan.floors[0]!;

  return (
    // aria-label, not aria-labelledby: the title's hidden moving copy would be read twice.
    <section aria-label={`Planos de ${name}`} className="mx-auto w-full max-w-7xl px-6 md:px-10">
      <FloorPlanViewer floors={floors} footprint={plan.footprint} initialFloor={firstStorey.id} />
    </section>
  );
}
