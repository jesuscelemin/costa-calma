import type { RefObject } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { captionFigures, type Caption } from "../../_lib/caption";

type RoomOverlayProps = {
  /** The cartela of the room pointed at on the picked floor, before going into it. */
  pointed: Caption | null;
  /** The cartela of the room gone into, if one is. */
  entered: Caption | null;
  onBack: () => void;
  backRef: RefObject<HTMLButtonElement | null>;
};

/** A room's cartela: its floor, its name, its figures from the plan, and its stop's line. */
export function RoomCaption({ caption, folded }: { caption: Caption; folded?: boolean }) {
  return (
    <div className={cn("flex flex-col gap-2", folded !== undefined && "max-md:gap-1")}>
      <p className={cn("type-eyebrow text-ink-muted", folded && "max-md:hidden")}>
        {caption.floor}
      </p>
      <h3
        className={cn(
          "type-heading text-ink",
          // On a phone the tour's stepper stands to its right.
          folded !== undefined && "max-md:truncate max-md:pr-36 max-md:type-title",
        )}
      >
        {caption.name}
      </h3>
      <p
        className={cn(
          "type-small font-semibold text-ink",
          folded !== undefined && "max-md:truncate max-md:pr-12",
        )}
      >
        {captionFigures(caption)}
      </p>
      {caption.line && (
        <p
          className={cn("text-ink-muted max-md:type-small md:type-body", folded && "max-md:hidden")}
        >
          {caption.line}
        </p>
      )}
    </div>
  );
}

const card = "absolute rounded-card bg-surface-raised/95 shadow-soft";

/**
 * On a phone, the room pointed at in the floor's panel, over its header, for the scene to stay
 * clear above it: its name, its figures and how to go in.
 */
export function PointedRoom({ caption }: { caption: Caption }) {
  return (
    <div
      data-room-caption="pointed"
      aria-hidden
      // Over the panel's header, not in its flow: nothing under a finger moves as it shows.
      className="absolute inset-0 flex flex-col bg-surface-raised md:hidden"
    >
      <p className="type-title text-ink">{caption.name}</p>
      <p className="type-small font-semibold text-ink">{captionFigures(caption)}</p>
      <p className="type-eyebrow text-accion">Vuelve a tocar para entrar</p>
    </div>
  );
}

/**
 * What a picked floor's rooms lay over the scene. A room pointed at shows its cartela beside the
 * floor, at the bottom right (on a phone, in the floor's panel: `PointedRoom`); inside a room, its
 * cartela at the bottom left, as the tour's, with «← Volver a la planta». The cartela inside is a
 * live region, so readers hear the room they are in.
 */
export function RoomOverlay({ pointed, entered, onBack, backRef }: RoomOverlayProps) {
  return (
    <>
      {pointed && !entered && (
        <div
          data-room-caption="pointed"
          // The list's button says it all to readers; this is its picture's caption.
          aria-hidden
          className={cn(
            card,
            "pointer-events-none right-10 bottom-10 flex w-sm flex-col gap-3 p-6 max-md:hidden",
          )}
        >
          <RoomCaption caption={pointed} />
          <p className="type-eyebrow text-accion">Pulsa para entrar</p>
        </div>
      )}
      <div
        className={cn(
          card,
          "inset-x-4 bottom-4 flex flex-col gap-4 p-4 md:right-auto md:bottom-10 md:left-10 md:w-md md:p-6",
          !entered && "pointer-events-none opacity-0",
        )}
      >
        <div data-room-caption="entered" aria-live="polite" aria-atomic="true">
          {entered && <RoomCaption caption={entered} />}
        </div>
        {entered && (
          <Button ref={backRef} variant="secondary" className="self-start" onClick={onBack}>
            <span aria-hidden>←</span> Volver a la planta
          </Button>
        )}
      </div>
    </>
  );
}
