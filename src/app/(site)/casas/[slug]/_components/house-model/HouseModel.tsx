"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";

import { Accent } from "@/components/ui/accent";
import { Button } from "@/components/ui/button";
import { SkipLink } from "@/components/ui/skip-link";
import type { HousePlan, Rect, Side } from "@/features/houses/schema";
import { trackProgress } from "@/lib/scrub/use-scrub";
import { REDUCED_MOTION_QUERY, useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";

import { modelPhases, phaseAt, type ModelPhase } from "../../_lib/model-choreography";
import type { ModelChapterCopy } from "../../_lib/model-copy";
import { modelPalettes } from "../../_lib/model-palette";
import { FloorPlanDrawing } from "../FloorPlanDrawing";
import type { PlanFloorView } from "../FloorPlanViewer";

import { useWebGL } from "./use-webgl";

// Three.js, React Three Fiber, drei and postprocessing come in their own chunk, only on the client.
const HouseModelScene = dynamic(() => import("./HouseModelScene"), { ssr: false });

type HouseModelProps = {
  name: string;
  plan: HousePlan;
  copy: Record<ModelPhase, ModelChapterCopy>;
  /** The ground floor's 2D plan: what shows without WebGL. */
  ground: PlanFloorView;
  bounds: Rect;
  partyWall?: Side;
  poster: { day: string; night: string };
  /** Where «Ver los planos» and the skip link go. */
  plansHref: string;
};

const counter = (n: number) => String(n).padStart(2, "0");

/**
 * The house model's pinned stretch: the text of each phase on the left (below on phones), the
 * model on the right (on top). The scroll through the stretch builds the house from its empty plot
 * to its floors apart in the air, forwards and back. The 3D loads as the stretch comes near, with
 * a poster until it draws.
 *
 * With reduced motion the house is already open and the stretch is not pinned; without WebGL, the
 * ground floor's 2D plan takes the model's place.
 */
export function HouseModel({
  name,
  plan,
  copy,
  ground,
  bounds,
  partyWall,
  poster,
  plansHref,
}: HouseModelProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const progress = useRef(0);
  const [phase, setPhase] = useState<ModelPhase>("plot");
  const [near, setNear] = useState(false);
  const [ready, setReady] = useState(false);
  const reducedMotion = useMediaQuery(REDUCED_MOTION_QUERY);
  const webgl = useWebGL();
  const { resolvedTheme } = useTheme();
  const palette = modelPalettes[resolvedTheme === "dark" ? "dark" : "light"];
  const still = reducedMotion === true;
  const pinned = !still && webgl !== false;
  const shown: ModelPhase = pinned ? phase : "open";

  // The 3D starts loading a screen before the stretch arrives.
  useEffect(() => {
    const section = sectionRef.current;
    if (!section || webgl !== true) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setNear(true);
        observer.disconnect();
      },
      { rootMargin: "100% 0px" },
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, [webgl]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    if (!pinned) {
      progress.current = 1;
      return;
    }
    let frame = 0;
    const update = () => {
      frame = 0;
      progress.current = trackProgress(track);
      setPhase(phaseAt(progress.current));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [pinned]);

  return (
    <section
      ref={sectionRef}
      aria-labelledby="maqueta-titulo"
      data-model-phase={shown}
      data-model-ready={ready || undefined}
    >
      <h2 id="maqueta-titulo" className="sr-only">
        Maqueta de {name}
      </h2>
      <SkipLink href={plansHref}>Saltar la maqueta</SkipLink>
      <div ref={trackRef} data-model-track className={cn(pinned && "h-[350svh] md:h-[400svh]")}>
        <div
          className={cn(
            "flex flex-col gap-6 px-2 md:grid md:grid-cols-12 md:items-center md:gap-10 md:px-4",
            pinned ? "sticky top-0 h-svh py-2 md:py-4" : "mx-auto w-full max-w-7xl",
          )}
        >
          <div
            className={cn(
              "relative overflow-hidden rounded-hero bg-surface md:order-last md:col-span-7",
              pinned ? "h-[55svh] shrink-0 md:h-full" : "aspect-4/3",
              webgl === false && "aspect-auto h-auto bg-transparent",
            )}
          >
            {webgl === false ? (
              <figure className="flex flex-col gap-3">
                <FloorPlanDrawing
                  floor={ground}
                  bounds={bounds}
                  partyWall={partyWall}
                  pointed={null}
                  idPrefix="maqueta-"
                />
                <figcaption className="type-small text-ink-muted">{ground.summary}</figcaption>
              </figure>
            ) : (
              <>
                {near && (
                  <HouseModelScene
                    plan={plan}
                    progress={progress}
                    palette={palette}
                    still={still}
                    onReady={() => setReady(true)}
                  />
                )}
                {/* The empty plot as the model first draws it, until it does. */}
                <div
                  aria-hidden
                  data-model-poster
                  className={cn(
                    "pointer-events-none absolute inset-0 transition-opacity duration-(--duration-slow) motion-reduce:transition-none",
                    ready && "opacity-0",
                  )}
                >
                  <Image
                    src={poster.day}
                    alt=""
                    fill
                    sizes="(width < 48rem) 100vw, 60vw"
                    className="object-cover dark:hidden"
                  />
                  <Image
                    src={poster.night}
                    alt=""
                    fill
                    sizes="(width < 48rem) 100vw, 60vw"
                    className="hidden object-cover dark:block"
                  />
                </div>
              </>
            )}
          </div>

          <div className="flex flex-col gap-6 px-4 md:col-span-5 md:px-6 lg:px-10">
            {/* Every phase's text in the same cell: the cell is as tall as the longest. */}
            <div className="grid">
              {modelPhases.map(({ id }, index) => {
                const { label, title, text } = copy[id];
                return (
                  <article
                    key={id}
                    aria-labelledby={`maqueta-${id}`}
                    data-active={id === shown || undefined}
                    className="flex flex-col gap-3 opacity-0 transition-opacity duration-(--duration-slow) [grid-area:1/1] motion-reduce:transition-none md:gap-4 data-active:opacity-100"
                  >
                    <p className="type-eyebrow text-ink-muted">
                      {counter(index + 1)} / {counter(modelPhases.length)} · {label}
                    </p>
                    <h3 id={`maqueta-${id}`} className="type-display-l text-ink">
                      {title.lead} <Accent>{title.accent}</Accent>
                    </h3>
                    <p className="max-w-md type-body text-ink-muted">{text}</p>
                  </article>
                );
              })}
            </div>
            <Button asChild variant="secondary" className="self-start rounded-full">
              <a href={plansHref}>Ver los planos</a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
