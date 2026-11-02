"use client";

import { useState } from "react";

import { Accent } from "@/components/ui/accent";
import { RevealText } from "@/components/ui/reveal-text";

import type { FloorGeometry } from "@/features/houses/plan";
import type { PlanFloor, Rect, Side } from "@/features/houses/schema";
import { formatArea } from "@/lib/format";
import { cn } from "@/lib/utils";

import { FloorPlanDrawing } from "./FloorPlanDrawing";

export type PlanFloorView = Pick<PlanFloor, "id" | "name" | "kind"> & {
  geometry: FloorGeometry;
  /** What the drawing frames: the plot, or the house's footprint. */
  frame: Rect;
  /** «120 m² en 9 estancias», or the plot's size. */
  summary: string;
  /** The end its stair is stepped on and off from, if it has one. */
  stairEntry?: Side;
};

type FloorPlanViewerProps = {
  floors: PlanFloorView[];
  footprint: Rect;
  initialFloor: string;
};

/**
 * Real buttons to pick a floor (keyboard, aria-pressed), the picked floor's plan and its rooms.
 * Pointing at a room in the list lights it on the plan.
 */
export function FloorPlanViewer({ floors, footprint, initialFloor }: FloorPlanViewerProps) {
  const [floorId, setFloorId] = useState(initialFloor);
  const [pointed, setPointed] = useState<string | null>(null);
  const floor = floors.find(({ id }) => id === floorId) ?? floors[0]!;

  return (
    <div className="grid gap-8 md:grid-cols-12 md:items-start md:gap-x-10">
      <div className="flex flex-col gap-4 md:col-span-5">
        <RevealText as="h2" className="type-display-l text-ink">
          Planta <Accent>a planta</Accent>
        </RevealText>
        <p className="type-body text-ink-muted">
          Elige una planta para ver su plano y sus estancias, con su superficie y su orientación.
        </p>
      </div>

      {/* On phones the plan comes right after the title; on desktop it fills the right column. */}
      <figure className="flex flex-col gap-3 md:col-span-7 md:col-start-6 md:row-span-3 md:row-start-1">
        <FloorPlanDrawing key={floor.id} floor={floor} footprint={footprint} pointed={pointed} />
        <figcaption className="type-small text-ink-muted">{floor.summary}</figcaption>
      </figure>

      <div
        role="group"
        aria-label="Plantas"
        className="-mx-6 flex gap-2 overflow-x-auto px-6 md:col-span-5 md:mx-0 md:flex-wrap md:overflow-visible md:px-0"
      >
        {floors.map(({ id, name }) => (
          <button
            key={id}
            type="button"
            aria-pressed={id === floor.id}
            onClick={() => {
              setFloorId(id);
              setPointed(null);
            }}
            className={cn(
              "h-11 shrink-0 cursor-pointer rounded-full border px-5 type-small font-semibold whitespace-nowrap focus-ring transition-colors motion-reduce:transition-none",
              id === floor.id
                ? "border-mar bg-mar-soft text-ink"
                : "border-line bg-surface-raised text-ink hover:bg-terracota-soft",
            )}
          >
            {name}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-4 md:col-span-5">
        <h3 id={`plano-${floor.id}-titulo`} className="type-title text-ink">
          {floor.name}
        </h3>
        <ul aria-labelledby={`plano-${floor.id}-titulo`} className="flex flex-col">
          {floor.geometry.rooms.map((room) => (
            <li
              key={room.id}
              onPointerEnter={() => setPointed(room.id)}
              onPointerLeave={() => setPointed(null)}
              className={cn(
                "flex items-baseline justify-between gap-4 border-b border-line py-3 transition-colors motion-reduce:transition-none",
                pointed === room.id && "border-terracota-text",
              )}
            >
              <div className="flex flex-col">
                <span className="type-body font-semibold text-ink">{room.name}</span>
                <span className="type-small text-ink-muted">
                  Orientación {room.orientation.toLowerCase()}
                </span>
              </div>
              <span className="type-body text-ink tabular-nums">{formatArea(room.area)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
