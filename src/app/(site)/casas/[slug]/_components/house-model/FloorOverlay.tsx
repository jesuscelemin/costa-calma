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
        className="pointer-events-none absolute inset-x-4 top-20 bottom-[52svh] md:top-20 md:right-6 md:bottom-10 md:left-[34%]"
      />
      {shown && (
        <div
          data-floor-picker
          className={cn(
            "absolute inset-x-4 bottom-4 flex max-h-[50svh] flex-col gap-4 rounded-card bg-surface-raised/95 p-4 shadow-soft md:gap-5",
            "md:top-24 md:right-auto md:left-10 md:w-md md:p-6",
            // The whole house needs only its floors' buttons; a floor, the height for its rooms.
            floor ? "md:bottom-10 md:max-h-none" : "md:bottom-auto",
          )}
        >
          <div className="relative flex min-h-[4.5rem] flex-col gap-2 md:min-h-0">
            <p className="type-eyebrow text-ink-muted">{name}</p>
            {floor ? (
              <p className="type-small text-ink-muted">{floor.summary}</p>
            ) : (
              <h3 className="type-heading text-ink">La casa entera</h3>
            )}
            {pointedRoom}
          </div>
          <FloorButtons
            floors={floors.map(({ id, name }) => ({ id, name }))}
            current={picked}
            onPick={onPick}
            label="Plantas"
            className="-mx-4 shrink-0 px-4 py-0.5 md:mx-0 md:px-0"
          />
          {floor && (
            <RoomList
              floor={floor}
              pointed={pointed}
              onPoint={onPoint}
              onEnter={onEnter}
              titleId="maqueta-estancias"
              // Room for each room's focus ring inside the scroll.
              className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1"
            />
          )}
          <div className="mt-auto flex shrink-0 flex-wrap gap-2">
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
