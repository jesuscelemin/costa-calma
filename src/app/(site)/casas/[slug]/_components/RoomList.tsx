import { formatArea } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { PlanFloorView } from "../_lib/floor-views";
import { canEnter } from "../_lib/caption";

type RoomListProps = {
  floor: PlanFloorView;
  /** The room pointed at, here or on the plan beside it. */
  pointed: string | null;
  onPoint: (id: string | null) => void;
  titleId: string;
  titleClassName?: string;
  /**
   * Each room that can be entered is a button that goes into it, and lights as it is focused, for
   * the list to be gone through with the keyboard.
   */
  onEnter?: (id: string) => void;
  className?: string;
};

type RoomGeometry = PlanFloorView["geometry"]["rooms"][number];

/** A room's name and orientation, and its m². */
function RoomFigures({ room }: { room: RoomGeometry }) {
  return (
    <>
      <span className="flex flex-col">
        <span className="type-body font-semibold text-ink max-md:type-small max-md:font-semibold">
          {room.name}
        </span>
        <span className="type-small text-ink-muted max-md:text-xs">
          Orientación {room.orientation.toLowerCase()}
        </span>
      </span>
      <span className="type-body text-ink tabular-nums max-md:type-small">
        {formatArea(room.area)}
      </span>
    </>
  );
}

/**
 * A floor's rooms with their m² and orientation. Pointing at one lights it beside the list, as
 * focusing it does when the list is gone through with the keyboard; with `onEnter`, Intro or a
 * click goes into it.
 */
export function RoomList({
  floor,
  pointed,
  onPoint,
  titleId,
  titleClassName,
  onEnter,
  className,
}: RoomListProps) {
  const row =
    "flex items-baseline justify-between gap-4 border-b border-line py-3 transition-colors max-md:py-2 group-data-pointed:border-terracota-text motion-reduce:transition-none";
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <h3 id={titleId} className={cn("type-title text-ink", titleClassName)}>
        {floor.name}
      </h3>
      <ul aria-labelledby={titleId} className="flex flex-col">
        {floor.geometry.rooms.map((room) => (
          <li
            key={room.id}
            data-pointed={pointed === room.id || undefined}
            onPointerEnter={() => onPoint(room.id)}
            onPointerLeave={() => onPoint(null)}
            className="group"
          >
            {onEnter && canEnter(room) ? (
              <button
                type="button"
                data-room-button={room.id}
                onClick={() => onEnter(room.id)}
                onFocus={() => onPoint(room.id)}
                onBlur={() => onPoint(null)}
                className={cn(row, "w-full cursor-pointer rounded-field px-2 text-left focus-ring")}
              >
                <span className="sr-only">Entrar en </span>
                <RoomFigures room={room} />
              </button>
            ) : (
              <div className={cn(row, onEnter && "px-2")}>
                <RoomFigures room={room} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
