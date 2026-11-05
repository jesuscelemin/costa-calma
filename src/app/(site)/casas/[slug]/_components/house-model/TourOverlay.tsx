import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { HouseSection } from "../../_lib/house-section";
import { STOREY_HEIGHT } from "../../_lib/model-geometry";
import type { Stop } from "../../_lib/tour";

import { RoomCaption } from "./RoomOverlay";

type TourOverlayProps = {
  section: HouseSection;
  stops: Stop[];
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
function StopCaption({ stops, stop }: Pick<TourOverlayProps, "stops" | "stop">) {
  const caption = stop === null ? null : stops[stop]?.caption;
  return (
    <div data-tour-caption aria-live="polite" aria-atomic="true">
      {caption && <RoomCaption caption={caption} />}
    </div>
  );
}

/** «← Anterior / Parada 03 / 08 / Siguiente →». */
function StopControls({
  stops,
  stop,
  onGo,
}: Omit<TourOverlayProps, "section" | "touring" | "onFloors">) {
  const current = stop ?? 0;
  return (
    <nav aria-label="Paradas del tour" className="flex items-center justify-between gap-2">
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

/** Closest two stops' points stand on the locator, in metres along the cut. */
const DOT_GAP = 1.9;

/**
 * Where each stop's point goes on the locator, along the cut and up: its camera, projected on the
 * corte's plane. Points of the same floor that would cover each other are pushed apart, in order.
 */
function locatorPoints(section: HouseSection, stops: Stop[]) {
  const points = stops.map(({ view }, index) => ({
    index,
    u: section.plane.runs === "north-south" ? view.from.z : view.from.x,
    y: view.from.y,
  }));
  const rows = new Map<number, typeof points>();
  for (const point of points) {
    const row = Math.floor(point.y / STOREY_HEIGHT);
    rows.set(row, [...(rows.get(row) ?? []), point]);
  }
  for (const row of rows.values()) {
    row.sort((a, b) => a.u - b.u);
    for (let i = 1; i < row.length; i++) {
      row[i]!.u = Math.max(row[i]!.u, row[i - 1]!.u + DOT_GAP);
    }
  }
  return points.sort((a, b) => a.index - b.index);
}

/**
 * The corte in miniature, at the bottom right, with a point for each stop: the one on screen
 * marked, any other pressed to go to it.
 */
function Locator({ section, stops, stop, onGo }: Omit<TourOverlayProps, "touring" | "onFloors">) {
  const { slabs, walls, terrain, pool, dimensions, levels } = section;
  const from = (dimensions[0] ?? terrain.from) - 1;
  const to = terrain.to + 0.5;
  const top = Math.max(...levels.map(({ y }) => y)) + STOREY_HEIGHT;
  const bottom = -terrain.depth;
  const [width, height] = [to - from, top - bottom];
  const points = locatorPoints(section, stops);
  return (
    <div
      role="group"
      aria-label="Localizador"
      className="relative w-36 md:w-80"
      style={{ aspectRatio: `${width} / ${height}` }}
    >
      <svg
        viewBox={`${from} ${-top} ${width} ${height}`}
        preserveAspectRatio="none"
        className="absolute inset-0 size-full"
        aria-hidden
      >
        <rect x={from} y={0} width={width} height={terrain.depth} className="fill-arena" />
        {pool && (
          <rect
            x={pool.from}
            y={0}
            width={pool.to - pool.from}
            height={pool.depth}
            className="fill-mar-soft"
          />
        )}
        {slabs.map(({ from, to, y, depth }, i) => (
          <rect
            key={`slab-${i}`}
            x={from}
            y={-y}
            width={to - from}
            height={depth}
            className="fill-ink-muted"
          />
        ))}
        {walls.flatMap(({ at, thickness, y, height, opening }, i) => {
          const pieces = opening
            ? [
                [y, y + opening.sill],
                [y + opening.head, y + height],
              ]
            : [[y, y + height]];
          return pieces
            .filter(([a, b]) => b! - a! > 0.01)
            .map(([a, b], j) => (
              <rect
                key={`wall-${i}-${j}`}
                x={at - Math.max(thickness, 0.12) / 2}
                y={-b!}
                width={Math.max(thickness, 0.12)}
                height={b! - a!}
                className="fill-ink-muted"
              />
            ));
        })}
      </svg>
      {points.map(({ index, u, y }) => {
        const here = index === stop;
        const name = stops[index]!.caption.name;
        return (
          <button
            key={index}
            type="button"
            aria-label={`Parada ${index + 1}: ${name}`}
            aria-current={here ? "step" : undefined}
            onClick={() => onGo(index)}
            className="group absolute flex size-6 -translate-1/2 cursor-pointer items-center justify-center rounded-full focus-ring"
            style={{
              left: `${((u - from) / width) * 100}%`,
              top: `${((top - y) / height) * 100}%`,
            }}
          >
            <span
              className={cn(
                "block rounded-full border-2 transition-[width,height,background-color] duration-(--duration-fast) motion-reduce:transition-none",
                here
                  ? "size-3.5 border-surface-raised bg-terracota-text"
                  : "size-2.5 border-ink bg-surface-raised group-hover:bg-terracota-soft",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}

/**
 * What the tour lays over the scene: the cartela and the controls at the bottom left, the locator
 * at the bottom right, or at the top right on phones, out of the room's way. Off the tour, only
 * the cartela's empty live region stays in the page.
 */
export function TourOverlay({ section, stops, stop, touring, onGo, onFloors }: TourOverlayProps) {
  const card = "pointer-events-auto absolute rounded-card bg-surface-raised/95 shadow-soft";
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
          card,
          "inset-x-4 bottom-4 flex flex-col gap-4 p-4 md:right-auto md:bottom-10 md:left-10 md:w-md md:p-6",
          // On the way in, before the first stop, only the locator shows. Faded, not hidden: the
          // live region stays in the accessibility tree, so the first stop is announced.
          (!touring || stop === null) && "pointer-events-none opacity-0",
        )}
      >
        <StopCaption stops={stops} stop={touring ? stop : null} />
        {touring && stop !== null && (
          <>
            <StopControls stops={stops} stop={stop} onGo={onGo} />
            <Button
              variant="ghost"
              size="sm"
              className="self-start px-0 underline-offset-4 hover:bg-transparent hover:underline"
              onClick={onFloors}
            >
              Ir a las plantas <span aria-hidden>↓</span>
            </Button>
          </>
        )}
      </div>
      {touring && (
        <div className={cn(card, "top-20 right-4 p-2 md:top-auto md:right-10 md:bottom-10 md:p-3")}>
          <Locator section={section} stops={stops} stop={stop} onGo={onGo} />
        </div>
      )}
    </div>
  );
}
