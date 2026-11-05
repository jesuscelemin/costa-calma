import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Map as MapIcon, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { WallKind } from "@/features/houses/plan";
import type { Rect, RoomKind } from "@/features/houses/schema";
import { cn } from "@/lib/utils";

import type { StopView } from "../../_lib/caption";
import type { PlanFloorView } from "../../_lib/floor-views";

import { RoomCaption } from "./RoomOverlay";

type TourOverlayProps = {
  /** The plan's floors, drawn on the locator. */
  floors: PlanFloorView[];
  stops: StopView[];
  /** The stop on screen, if the tour has reached one. */
  stop: number | null;
  /** The tour is on screen: its controls show. */
  touring: boolean;
  onGo: (stop: number) => void;
  /** Straight to the end of the tour: the whole house and its floors. */
  onFloors: () => void;
};

/** «03»: a stop's number as the controls show it. */
const twoDigits = (n: number) => String(n).padStart(2, "0");

/**
 * The cartela of the stop on screen, at the bottom left: the room's name, its figures from the plan
 * and the stop's line. Always in the page, empty off the tour, so readers hear each stop as it
 * changes.
 */
function StopCaption({
  stops,
  stop,
  folded,
}: Pick<TourOverlayProps, "stops" | "stop"> & { folded: boolean }) {
  const caption = stop === null ? null : stops[stop]?.caption;
  return (
    <div id="tour-caption" data-tour-caption aria-live="polite" aria-atomic="true">
      {caption && <RoomCaption caption={caption} folded={folded} />}
    </div>
  );
}

/** «← Anterior / Parada 03 / 08 / Siguiente →». */
function StopControls({ stops, stop, onGo }: Pick<TourOverlayProps, "stops" | "stop" | "onGo">) {
  const current = stop ?? 0;
  return (
    <nav
      aria-label="Paradas del tour"
      className="hidden items-center justify-between gap-2 md:flex"
    >
      <Button
        variant="secondary"
        size="sm"
        className="px-3 md:px-4"
        disabled={current === 0}
        onClick={() => onGo(current - 1)}
      >
        <span aria-hidden>←</span> Anterior
      </Button>
      <p className="type-small font-semibold whitespace-nowrap text-ink tabular-nums">
        Parada {twoDigits(current + 1)} / {twoDigits(stops.length)}
      </p>
      <Button
        variant="secondary"
        size="sm"
        className="px-3 md:px-4"
        disabled={current === stops.length - 1}
        onClick={() => onGo(current + 1)}
      >
        Siguiente <span aria-hidden>→</span>
      </Button>
    </nav>
  );
}

/** On a phone, the same controls in a corner of the cartela: «‹ 03 / 08 ›». */
function PhoneStopControls({
  stops,
  stop,
  onGo,
}: Pick<TourOverlayProps, "stops" | "stop" | "onGo">) {
  const current = stop ?? 0;
  return (
    <nav aria-label="Paradas del tour" className="flex items-center md:hidden">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Anterior"
        disabled={current === 0}
        onClick={() => onGo(current - 1)}
      >
        <ChevronLeft aria-hidden className="size-5" />
      </Button>
      <p className="type-small font-semibold whitespace-nowrap text-ink tabular-nums">
        <span className="sr-only">Parada </span>
        {twoDigits(current + 1)} / {twoDigits(stops.length)}
      </p>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Siguiente"
        disabled={current === stops.length - 1}
        onClick={() => onGo(current + 1)}
      >
        <ChevronRight aria-hidden className="size-5" />
      </Button>
    </nav>
  );
}

/** Wall thickness on the locator, in metres. */
const THICKNESS: Record<WallKind, number> = {
  exterior: 0.24,
  interior: 0.1,
  railing: 0.06,
  party: 0.3,
};

/** Outdoor rooms drawn around the ground floor, and their fill. */
const OUTDOOR_FILL: Partial<Record<RoomKind, string>> = {
  deck: "fill-arena",
  patio: "fill-arena",
  solarium: "fill-arena",
  pool: "fill-mar-soft",
};

/** Space round the house on the locator, in metres. */
const MARGIN = 0.8;

/** A floor's name as a phone's tab has it: «Planta baja», «Baja». */
const shortName = (name: string) => {
  const short = name.replace(/\s*planta\s*/i, "");
  return short ? short.charAt(0).toUpperCase() + short.slice(1) : name;
};

const centre = (room: Rect) => ({ x: room.x + room.w / 2, z: room.z + room.d / 2 });

/**
 * The locator's plans, worked out from the floors: the storeys the tour stops on, each with its
 * points at the middle of their rooms, all in the same frame. The plot's stops, the porch and
 * the like, are drawn on the ground floor, the level they are walked at, with the plot's outdoor
 * rooms round it.
 */
function locatorPlans(floors: PlanFloorView[], stops: StopView[]) {
  const plot = floors.find(({ kind }) => kind === "plot");
  const storeys = floors.filter(({ kind }) => kind !== "plot");
  const ground = storeys[0];
  const shownOn = (floor: string) => (floor === plot?.id ? ground?.id : floor);
  const roomOf = ({ floor, room }: StopView) =>
    floors.find(({ id }) => id === floor)?.geometry.rooms.find(({ id }) => id === room);
  const points = stops.flatMap((one, index) => {
    const room = roomOf(one);
    const floor = shownOn(one.floor);
    return room && floor ? [{ index, floor, room: room.id, ...centre(room) }] : [];
  });
  const outdoors = (plot?.geometry.rooms ?? []).filter(({ kind }) => OUTDOOR_FILL[kind]);
  // The storeys' frame, and any room the tour stops in out of it.
  const rects = [...(ground ? [ground.frame] : []), ...stops.flatMap((one) => roomOf(one) ?? [])];
  const x = Math.min(...rects.map((rect) => rect.x)) - MARGIN;
  const z = Math.min(...rects.map((rect) => rect.z)) - MARGIN;
  const frame = {
    x,
    z,
    w: Math.max(...rects.map((rect) => rect.x + rect.w)) + MARGIN - x,
    d: Math.max(...rects.map((rect) => rect.z + rect.d)) + MARGIN - z,
  };
  const plans = storeys
    .filter(({ id }) => points.some((point) => point.floor === id))
    .map((floor) => ({
      floor,
      outdoors: floor === ground ? outdoors : [],
      points: points.filter((point) => point.floor === floor.id),
    }));
  return { frame, plans, shownOn };
}

type LocatorProps = Pick<TourOverlayProps, "floors" | "stops" | "stop" | "onGo">;

/**
 * The floor the tour is on in miniature, at the bottom right: its rooms and walls from the plan,
 * the room on screen lit, and a point for each stop on it, any pressed to go there. Tabs show the
 * other floors and their stops.
 */
function Locator({ floors, stops, stop, onGo }: LocatorProps) {
  const { frame, plans, shownOn } = locatorPlans(floors, stops);
  const current = shownOn(stops[stop ?? 0]?.floor ?? "") ?? plans[0]?.floor.id;
  // A floor looked at by its tab, until the tour moves to another stop.
  const [looked, setLooked] = useState<{ stop: number | null; floor: string } | null>(null);
  const shown = looked && looked.stop === stop ? looked.floor : current;
  const plan = plans.find(({ floor }) => floor.id === shown) ?? plans[0];
  if (!plan) return null;
  const here = stop === null ? undefined : stops[stop];
  const lit = here && shownOn(here.floor) === plan.floor.id ? here.room : undefined;
  return (
    <div role="group" aria-label="Localizador" className="flex w-44 flex-col gap-2 md:w-64">
      {plans.length > 1 && (
        <div className="flex flex-wrap gap-1">
          {plans.map(({ floor }) => (
            <button
              key={floor.id}
              type="button"
              aria-label={floor.name}
              aria-pressed={floor.id === plan.floor.id}
              onClick={() => setLooked({ stop, floor: floor.id })}
              className={cn(
                "rounded-pill cursor-pointer px-2.5 py-1 type-small font-semibold focus-ring transition-colors duration-(--duration-fast) motion-reduce:transition-none",
                floor.id === plan.floor.id
                  ? "bg-mar-soft text-ink"
                  : "text-ink-muted hover:bg-terracota-soft hover:text-ink",
              )}
            >
              <span className="md:hidden">{shortName(floor.name)}</span>
              <span className="hidden md:inline">{floor.name}</span>
            </button>
          ))}
        </div>
      )}
      <div className="relative" style={{ aspectRatio: `${frame.w} / ${frame.d}` }}>
        <svg
          viewBox={`${frame.x} ${frame.z} ${frame.w} ${frame.d}`}
          className="absolute inset-0 size-full"
          aria-hidden
        >
          {plan.outdoors.map((room) => (
            <rect
              key={room.id}
              x={room.x}
              y={room.z}
              width={room.w}
              height={room.d}
              className={cn(
                room.id === lit ? "fill-terracota-soft" : OUTDOOR_FILL[room.kind],
                "transition-[fill] duration-(--duration-fast) motion-reduce:transition-none",
              )}
            />
          ))}
          {plan.floor.geometry.rooms.map((room) => (
            <rect
              key={room.id}
              x={room.x}
              y={room.z}
              width={room.w}
              height={room.d}
              className={cn(
                room.id === lit
                  ? "fill-terracota-soft"
                  : room.kind === "void"
                    ? "fill-surface-sunken"
                    : "fill-surface-raised",
                "stroke-line transition-[fill] duration-(--duration-fast) motion-reduce:transition-none",
              )}
              strokeWidth={0.05}
            />
          ))}
          {plan.floor.geometry.walls.map(({ x1, z1, x2, z2, kind }, i) => (
            <line
              key={i}
              x1={x1}
              y1={z1}
              x2={x2}
              y2={z2}
              strokeWidth={THICKNESS[kind]}
              strokeLinecap="square"
              className={kind === "railing" ? "stroke-ink-muted" : "stroke-ink"}
            />
          ))}
        </svg>
        {plan.points.map(({ index, x, z }) => {
          const on = index === stop;
          const name = stops[index]!.caption.name;
          return (
            <button
              key={index}
              type="button"
              aria-label={`Parada ${index + 1}: ${name}`}
              aria-current={on ? "step" : undefined}
              onClick={() => onGo(index)}
              className="group absolute flex size-6 -translate-1/2 cursor-pointer items-center justify-center rounded-full focus-ring"
              style={{
                left: `${((x - frame.x) / frame.w) * 100}%`,
                top: `${((z - frame.z) / frame.d) * 100}%`,
              }}
            >
              <span
                className={cn(
                  "block rounded-full border-2 transition-[width,height,background-color] duration-(--duration-fast) motion-reduce:transition-none",
                  on
                    ? "size-3.5 border-surface-raised bg-terracota-text"
                    : "size-2.5 border-ink bg-surface-raised group-hover:bg-terracota-soft",
                )}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * On a phone, the locator folded into a button at the top right, out of the room's way: pressed,
 * it opens; it closes again on a stop picked, a tap outside or Escape. On a wider screen it is
 * always open.
 */
function PhoneLocator(props: LocatorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  const card = "rounded-card bg-surface-raised/95 shadow-soft";
  return (
    <div
      ref={ref}
      className="pointer-events-auto absolute top-20 right-4 flex flex-col items-end gap-2 md:top-auto md:right-10 md:bottom-10"
    >
      <Button
        variant="secondary"
        size="icon"
        className="shadow-soft md:hidden"
        aria-label={open ? "Cerrar el plano" : "Plano"}
        aria-expanded={open}
        aria-controls="tour-locator"
        onClick={() => setOpen(!open)}
      >
        {open ? <X aria-hidden className="size-5" /> : <MapIcon aria-hidden className="size-5" />}
      </Button>
      <div id="tour-locator" className={cn(card, "p-2 md:block md:p-3", !open && "max-md:hidden")}>
        <Locator
          {...props}
          onGo={(index) => {
            setOpen(false);
            props.onGo(index);
          }}
        />
      </div>
    </div>
  );
}

/**
 * What the tour lays over the scene: the cartela and the controls at the bottom left, the locator
 * at the bottom right, or folded at the top right on phones, out of the room's way. On a phone the
 * cartela folds too, to the room's name and figures, and opens to its line and «Ir a las plantas».
 * Off the tour, only the cartela's empty live region stays in the page.
 */
export function TourOverlay({ floors, stops, stop, touring, onGo, onFloors }: TourOverlayProps) {
  const [unfolded, setUnfolded] = useState(false);
  const shown = touring && stop !== null;
  return (
    <div
      data-tour
      className={cn(
        "pointer-events-none absolute inset-0",
        "transition-opacity duration-(--duration-slow) motion-reduce:transition-none",
        !touring && "opacity-0",
      )}
    >
      <div
        className={cn(
          "pointer-events-auto absolute rounded-card bg-surface-raised/95 shadow-soft",
          "inset-x-4 bottom-4 flex flex-col gap-2 py-3 pr-2 pl-4 md:right-auto md:bottom-10 md:left-10 md:w-md md:gap-4 md:p-6",
          // On the way in, before the first stop, only the locator shows. Faded, not hidden: the
          // live region stays in the accessibility tree, so the first stop is announced.
          !shown && "pointer-events-none opacity-0",
        )}
      >
        <StopCaption stops={stops} stop={touring ? stop : null} folded={!unfolded} />
        {shown && (
          <>
            <div className="absolute top-1 right-1">
              <PhoneStopControls stops={stops} stop={stop} onGo={onGo} />
            </div>
            <StopControls stops={stops} stop={stop} onGo={onGo} />
            <div
              className={cn(
                "flex items-center justify-between",
                // Folded, the toggle stands alone in the cartela's corner.
                !unfolded && "max-md:contents",
              )}
            >
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "self-start px-0 underline-offset-4 hover:bg-transparent hover:underline",
                  !unfolded && "max-md:hidden",
                )}
                onClick={onFloors}
              >
                Ir a las plantas <span aria-hidden>↓</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={cn("md:hidden", !unfolded && "absolute right-1 bottom-0.5")}
                aria-label={unfolded ? "Menos sobre la estancia" : "Más sobre la estancia"}
                aria-expanded={unfolded}
                aria-controls="tour-caption"
                onClick={() => setUnfolded(!unfolded)}
              >
                {unfolded ? (
                  <ChevronDown aria-hidden className="size-5" />
                ) : (
                  <ChevronUp aria-hidden className="size-5" />
                )}
              </Button>
            </div>
          </>
        )}
      </div>
      {touring && <PhoneLocator floors={floors} stops={stops} stop={stop} onGo={onGo} />}
    </div>
  );
}
