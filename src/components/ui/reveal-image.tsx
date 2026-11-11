"use client";

import { useRef } from "react";

import { useReveal } from "@/lib/use-reveal";
import { cn } from "@/lib/utils";

type RevealImageProps = {
  className?: string;
  /** The image, usually a `next/image` with `fill`. */
  children: React.ReactNode;
};

/**
 * A photograph that opens from the bottom up as it scrolls into view while it settles from a slow
 * zoom, up to 1,2 s (ADR 0014). The frame is observed and the mask inside it is clipped, since a
 * fully clipped element never reports itself in view. Still with reduced motion; shown anyway if
 * the script never runs (`[data-image-reveal]` in globals.css).
 */
export function RevealImage({ className, children }: RevealImageProps) {
  const ref = useRef<HTMLDivElement>(null);
  // As soon as an edge shows, so a carousel's peeking card is not an empty frame.
  useReveal(ref, undefined, 0.05);
  return (
    <div ref={ref} data-image-reveal="" className={cn("relative overflow-hidden", className)}>
      <div data-image-reveal-mask="" className="absolute inset-0">
        {children}
      </div>
    </div>
  );
}
