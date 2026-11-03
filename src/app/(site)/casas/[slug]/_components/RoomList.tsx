import { formatArea } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { PlanFloorView } from "../_lib/floor-views";

type RoomListProps = {
  floor: PlanFloorView;
  /** The room pointed at, here or on the plan beside it. */
  pointed: string | null;
  onPoint: (id: string | null) => void;
  titleId: string;
  /** On phones beside the floor buttons, which already say it: read, not shown. */
  hideTitleOnPhones?: boolean;
  className?: string;
  /** The list scrolls within its own height, given by `listClassName`, and takes the focus too. */
  scrolls?: boolean;
  listClassName?: string;
};

/** A floor's rooms with their m² and orientation. Pointing at one lights it beside the list. */
export function RoomList({
  floor,
  pointed,
  onPoint,
  titleId,
  hideTitleOnPhones = false,
  className,
  scrolls = false,
  listClassName,
}: RoomListProps) {
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <h3 id={titleId} className={cn("type-title text-ink", hideTitleOnPhones && "max-md:sr-only")}>
        {floor.name}
      </h3>
      <ul
        aria-labelledby={titleId}
        tabIndex={scrolls ? 0 : undefined}
        className={cn("flex flex-col", scrolls && "overflow-y-auto focus-ring", listClassName)}
      >
        {floor.geometry.rooms.map((room) => (
          <li
            key={room.id}
            data-pointed={pointed === room.id || undefined}
            onPointerEnter={() => onPoint(room.id)}
            onPointerLeave={() => onPoint(null)}
            className="flex items-baseline justify-between gap-4 border-b border-line py-3 transition-colors data-pointed:border-terracota-text motion-reduce:transition-none"
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
  );
}
