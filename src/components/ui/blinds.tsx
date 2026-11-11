"use client";

import { useRef } from "react";

import { blindDelay } from "@/lib/reveal";
import { useReveal } from "@/lib/use-reveal";
import { cn } from "@/lib/utils";

type BlindsProps = {
  /** How many slats cover the image. */
  count?: number;
  className?: string;
  children: React.ReactNode;
};

/**
 * An image behind horizontal slats of the page's colour that open one after another, top to
 * bottom, as it scrolls into view (ADR 0014). No slats with reduced motion or if the script never
 * runs (`[data-blinds]` in globals.css).
 */
export function Blinds({ count = 6, className, children }: BlindsProps) {
  const ref = useRef<HTMLDivElement>(null);
  useReveal(ref, undefined, 0.3);
  return (
    <div ref={ref} data-blinds="" className={cn("relative overflow-hidden", className)}>
      {children}
      <div aria-hidden className="pointer-events-none absolute inset-0 flex flex-col">
        {Array.from({ length: count }, (_, index) => (
          <div
            key={index}
            data-blind=""
            className="flex-1 bg-surface"
            style={{ "--reveal-delay": `${blindDelay(index)}ms` } as React.CSSProperties}
          />
        ))}
      </div>
    </div>
  );
}
