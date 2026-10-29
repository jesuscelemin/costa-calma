"use client";

import { useEffect, useRef } from "react";

import { Logo } from "@/components/ui/logo";
import { playIntro } from "@/lib/intro";

/**
 * The landing's loading intro: the logo's sun rises over its swaying waves on a full-screen
 * overlay, which fades to uncover the hero. Rendered always, but hidden unless the gate has marked
 * this visit (`html[data-intro]`, see globals.css), so without JavaScript there is none. With
 * reduced motion the logo stands still and the overlay only fades.
 */
export function Intro() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) playIntro(ref.current);
  }, []);

  return (
    <div
      ref={ref}
      role="status"
      data-intro-overlay
      className="fixed inset-0 z-60 place-items-center bg-surface"
    >
      <div aria-hidden className="relative">
        {/* A low warm glow where the sun comes up. */}
        <div className="absolute inset-x-[-50%] top-1/4 bottom-[-25%] bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--sol)_28%,transparent),transparent)]" />
        <Logo variant="mark" className="relative size-36 md:size-48" />
      </div>
      <span className="sr-only">Cargando Costa Calma…</span>
    </div>
  );
}
