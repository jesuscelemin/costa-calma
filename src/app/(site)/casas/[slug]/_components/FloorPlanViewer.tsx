"use client";

import { useState } from "react";

import { Accent } from "@/components/ui/accent";
import { RevealText } from "@/components/ui/reveal-text";

import type { Rect, Side } from "@/features/houses/schema";

import type { PlanFloorView } from "../_lib/floor-views";

import { FloorButtons } from "./FloorButtons";
import { FloorPlanDrawing } from "./FloorPlanDrawing";
import { RoomList } from "./RoomList";

type FloorPlanViewerProps = {
  floors: PlanFloorView[];
  /** The rectangle that holds every storey. */
  bounds: Rect;
  /** Half of a semi-detached pair: the side shared with the neighbour. */
  partyWall?: Side;
  initialFloor: string;
  /** Under the corte, without WebGL: a quieter title of its own instead of «Planta a planta». */
  title?: string;
};

/**
 * Real buttons to pick a floor (keyboard, aria-pressed), the picked floor's plan and its rooms.
 * Pointing at a room in the list lights it on the plan.
 */
export function FloorPlanViewer({
  floors,
  bounds,
  partyWall,
  initialFloor,
  title,
}: FloorPlanViewerProps) {
  const [floorId, setFloorId] = useState(initialFloor);
  const [pointed, setPointed] = useState<string | null>(null);
  const floor = floors.find(({ id }) => id === floorId) ?? floors[0]!;

  return (
    <div className="grid gap-8 md:grid-cols-12 md:items-start md:gap-x-10">
      <div className="flex flex-col gap-4 md:col-span-5">
        {title ? (
          <h3 className="type-heading text-ink">{title}</h3>
        ) : (
          <RevealText as="h2" className="type-display-l text-ink">
            Planta <Accent>a planta</Accent>
          </RevealText>
        )}
        <p className="type-body text-ink-muted">
          Elige una planta para ver su plano y sus estancias, con su superficie y su orientación.
        </p>
      </div>

      {/* On phones the plan comes right after the title; on desktop it fills the right column. */}
      <figure className="flex flex-col gap-3 md:col-span-7 md:col-start-6 md:row-span-3 md:row-start-1">
        <FloorPlanDrawing
          key={floor.id}
          floor={floor}
          bounds={bounds}
          partyWall={partyWall}
          pointed={pointed}
        />
        <figcaption className="type-small text-ink-muted">{floor.summary}</figcaption>
      </figure>

      <FloorButtons
        label="Plantas"
        floors={floors}
        current={floor.id}
        onPick={(id) => {
          setFloorId(id);
          setPointed(null);
        }}
        className="md:col-span-5"
      />

      <RoomList
        floor={floor}
        pointed={pointed}
        onPoint={setPointed}
        titleId={`plano-${floor.id}-titulo`}
        className="md:col-span-5"
      />
    </div>
  );
}
