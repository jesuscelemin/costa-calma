import type { Rect, SheetHeading, Side } from "@/features/houses/schema";

import type { PlanFloorView } from "../../_lib/floor-views";
import type { HouseSection } from "../../_lib/house-section";
import { FloorPlanViewer } from "../FloorPlanViewer";
import { SectionDrawing } from "../SectionDrawing";

import { ModelHeading } from "./ModelHeading";

/** The corte, the house in words for those who cannot see it, and which way it is cut. */
export type ModelSection = { drawing: HouseSection; description: string; runs: string };

type ModelFallbackProps = {
  name: string;
  heading: SheetHeading;
  section: ModelSection;
  floors: PlanFloorView[];
  firstStorey: string;
  bounds: Rect;
  partyWall?: Side;
};

/** Without WebGL, the model's place: the corte in SVG, and the floors' 2D plans under it. */
export default function ModelFallback({
  name,
  heading,
  section,
  floors,
  firstStorey,
  bounds,
  partyWall,
}: ModelFallbackProps) {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-6 md:gap-16 md:px-10">
      <ModelHeading name={name} heading={heading} />
      <figure data-model-section className="-mx-4 flex flex-col gap-3 md:-mx-6">
        <SectionDrawing
          section={section.drawing}
          title={`Corte de ${name}`}
          description={section.description}
          idPrefix="maqueta-"
        />
        <figcaption className="type-small text-ink-muted">
          {name} cortada {section.runs}, con sus niveles y cotas.
        </figcaption>
      </figure>
      <FloorPlanViewer
        title="Sus plantas"
        floors={floors}
        bounds={bounds}
        partyWall={partyWall}
        initialFloor={firstStorey}
      />
    </div>
  );
}
