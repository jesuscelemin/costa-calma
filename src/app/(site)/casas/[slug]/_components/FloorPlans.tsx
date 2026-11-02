import type { CatalogHouseType } from "@/features/houses/catalog";

import { floorViews } from "../_lib/floor-views";

import { FloorPlanViewer } from "./FloorPlanViewer";

type FloorPlansProps = {
  houseType: CatalogHouseType;
};

/**
 * The plan of each floor, drawn from the same data as the house's figures: buttons to pick a
 * floor, its plan and its rooms with their m² and orientation. The model's accessible
 * alternative, and the plan as a visitor reads it before the 3D.
 */
export function FloorPlans({ houseType: { plan, name } }: FloorPlansProps) {
  const { floors, bounds, firstStorey } = floorViews(plan);

  return (
    // aria-label, not aria-labelledby: the title's hidden moving copy would be read twice.
    <section
      id="planos"
      aria-label={`Planos de ${name}`}
      className="mx-auto w-full max-w-7xl scroll-mt-24 px-6 md:px-10"
    >
      <FloorPlanViewer
        floors={floors}
        bounds={bounds}
        partyWall={plan.partyWall}
        initialFloor={firstStorey}
      />
    </section>
  );
}
