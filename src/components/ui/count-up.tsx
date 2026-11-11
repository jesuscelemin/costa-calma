"use client";

import { useRef } from "react";

import { formatArea, formatNumber } from "@/lib/format";
import { prefersReducedMotion } from "@/lib/gsap";
import { countUpAt } from "@/lib/reveal";
import { useReveal } from "@/lib/use-reveal";

const formats = { number: formatNumber, area: formatArea } as const;

type CountUpProps = {
  value: number;
  /** How the figure is written: "4", or "448 m²". */
  format?: keyof typeof formats;
  className?: string;
};

/**
 * A figure that counts up from 0 as it scrolls into view (ADR 0014). Screen readers, the server
 * render and reduced motion get the final figure; only the moving copy counts.
 */
export function CountUp({ value, format = "number", className }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const write = formats[format];

  useReveal(ref, (element) => {
    const visual = element.querySelector<HTMLElement>("[data-count-up-visual]");
    if (!visual || prefersReducedMotion()) return;
    const start = performance.now();
    const tick = (now: number) => {
      const current = countUpAt(value, now - start);
      visual.textContent = write(current);
      if (current !== value && element.isConnected) requestAnimationFrame(tick);
    };
    visual.textContent = write(0);
    requestAnimationFrame(tick);
  });

  return (
    <span ref={ref} data-count-up="" className={className}>
      <span className="sr-only">{write(value)}</span>
      <span aria-hidden data-count-up-visual="">
        {write(value)}
      </span>
    </span>
  );
}
