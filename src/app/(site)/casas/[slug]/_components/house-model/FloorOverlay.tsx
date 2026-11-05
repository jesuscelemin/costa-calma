import type { ReactNode, RefObject } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { landingSections, sectionHref } from "../../../../_lib/sections";
import type { PlanFloorView } from "../../_lib/floor-views";
import { FloorButtons } from "../FloorButtons";
import { RoomList } from "../RoomList";

type FloorOverlayProps = {
  name: string;
  floors: PlanFloorView[];
  /** The floor picked, if one is; none on the whole house. */
  picked: string | null;
  /** The room pointed at in the picked floor's list. */
  pointed: string | null;
  /** On a phone, the room pointed at, in place of the floor's summary. */
  pointedRoom?: ReactNode;
  /** The whole house is on screen, or a floor of it: the panel shows. */
  shown: boolean;
  onPick: (floor: string) => void;
  onWhole: () => void;
  onPoint: (room: string | null) => void;
  /** Goes into one of the picked floor's rooms. */
  onEnter: (room: string) => void;
  /** Where the scene frames a picked floor: beside the panel, or over it on a phone. */
  areaRef: RefObject<HTMLDivElement | null>;
};

/**
 * What the end of the model lays over the scene: the whole house's floors to pick from, with
 * «Reservar visita», the view's one primary button; once a floor is picked, its rooms, each lit in
 * the scene as it is pointed at or focused and gone into as it is pressed, and «Ver la casa
 * entera». Beside it on desktop, over
 * it on a phone, the area the scene frames the floor in.
 */
export function FloorOverlay({
  name,
  floors,
  picked,
  pointed,
  pointedRoom,
  shown,
  onPick,
  onWhole,
  onPoint,
  onEnter,
  areaRef,
}: FloorOverlayProps) {
  const floor = floors.find(({ id }) => id === picked);
  return (
    <>
      <div
        ref={areaRef}
        data-floor-area
        aria-hidden
        className="pointer-events-none absolute inset-x-4 top-20 bottom-[calc(50svh+2.5rem)] md:top-20 md:right-6 md:bottom-10 md:left-[34%]"
      />
      {shown && (
        <div
          data-floor-picker
          className={cn(
            "absolute inset-x-4 bottom-4 flex max-h-[50svh] flex-col gap-3 rounded-card bg-surface-raised/95 p-4 shadow-soft md:gap-5",
            "md:top-24 md:right-auto md:left-10 md:w-md md:p-6",
            // The whole house needs only its floors' buttons; a floor, the height for its rooms.
            floor ? "md:bottom-10 md:max-h-none" : "md:bottom-auto",
          )}
        >
          <div className="relative flex min-h-[4.5rem] flex-col gap-2 md:min-h-0">
            {/* A floor's header reads as its pointed room does on a phone, over it: a title, its
                figures and what a touch or the mouse does, the same sizes either way. */}
            {floor ? (
              <div data-floor-header className="flex flex-col">
                <p className="type-title text-ink">{floor.name}</p>
                <p className="type-small font-semibold text-ink">{floor.figures}</p>
                <p className="type-eyebrow text-ink-muted">
                  <span className="md:hidden">Toca una estancia para verla</span>
                  <span className="max-md:hidden">Pasa el ratón por una estancia para verla</span>
                </p>
              </div>
            ) : (
              <>
                <p className="type-eyebrow text-ink-muted">{name}</p>
                <h3 className="type-heading text-ink">La casa entera</h3>
              </>
            )}
            {pointedRoom}
          </div>
          <FloorButtons
            floors={floors.map(({ id, name }) => ({ id, name }))}
            current={picked}
            onPick={onPick}
            label="Plantas"
            // On a phone, one row as wide as the panel: every floor in sight, none cut by its edge.
            compact
            className="shrink-0 py-0.5"
          />
          {floor && (
            <RoomList
              floor={floor}
              pointed={pointed}
              onPoint={onPoint}
              onEnter={onEnter}
              titleId="maqueta-estancias"
              // The header above already names the floor.
              titleClassName="sr-only"
              scrolls
              className="flex-1 gap-0"
            />
          )}
          <div
            className={cn(
              "mt-auto flex shrink-0 flex-wrap gap-2",
              // A floor's two buttons side by side on a phone, halves of the panel.
              floor && "max-md:grid max-md:grid-cols-2 max-md:[&>*]:px-3 max-md:[&>*]:text-sm",
            )}
          >
            {floor && (
              <Button variant="secondary" onClick={onWhole}>
                Ver la casa entera
              </Button>
            )}
            <Button asChild>
              <a href={sectionHref(landingSections.visit)}>Reservar visita</a>
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
