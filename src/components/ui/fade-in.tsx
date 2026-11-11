"use client";

import { useRef } from "react";

import { useReveal } from "@/lib/use-reveal";

type FadeInProps = {
  as?: "div" | "p" | "li" | "section";
  className?: string;
  /** Delay before it starts, in ms, to follow a title in. */
  delay?: number;
  children: React.ReactNode;
};

/**
 * Text or a block that rises a little and fades in as it scrolls into view. Still with reduced
 * motion; shown anyway if the script never runs (`[data-fade-in]` in globals.css).
 */
export function FadeIn({ as: Tag = "div", className, delay = 0, children }: FadeInProps) {
  const ref = useRef<HTMLElement>(null);
  useReveal(ref);
  return (
    <Tag
      ref={ref as React.Ref<HTMLDivElement & HTMLParagraphElement & HTMLLIElement>}
      data-fade-in=""
      className={className}
      style={delay ? ({ "--reveal-delay": `${delay}ms` } as React.CSSProperties) : undefined}
    >
      {children}
    </Tag>
  );
}
