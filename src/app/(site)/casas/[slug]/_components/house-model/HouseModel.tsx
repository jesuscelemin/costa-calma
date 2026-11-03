"use client";

import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";

import { Accent } from "@/components/ui/accent";
import { SkipLink } from "@/components/ui/skip-link";
import type { HousePlan, Rect } from "@/features/houses/schema";
import { trackProgress } from "@/lib/scrub/use-scrub";
import { MOBILE_QUERY, REDUCED_MOTION_QUERY, useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";

import type { PlanFloorView } from "../../_lib/floor-views";
import { sectionRuns, type HouseSection } from "../../_lib/house-section";
import { phaseAt, type ModelPhase } from "../../_lib/model-choreography";
import { modelPalettes } from "../../_lib/model-palette";
import { FloorPlanViewer } from "../FloorPlanViewer";
import { SectionDrawing } from "../SectionDrawing";

import { SectionSheet, type PlaceSheet } from "./SectionSheet";
import type { DrawingArea } from "./HouseModelScene";
import { useWebGL } from "./use-webgl";

// Three.js, React Three Fiber and drei come in their own chunk, only on the client.
const HouseModelScene = dynamic(() => import("./HouseModelScene"), { ssr: false });

type HouseModelProps = {
  name: string;
  plan: HousePlan;
  /** Its corte, and the house in words for those who cannot see it. */
  section: { drawing: HouseSection; description: string };
  /** Each floor's 2D plan and rooms, which show without WebGL. */
  floors: PlanFloorView[];
  /** The floor whose 2D plan shows without WebGL until another is picked: the ground floor. */
  firstStorey: string;
  bounds: Rect;
  /** Where the skip link goes: what follows the model. */
  skipHref: string;
};

/** With reduced motion, how long the scene takes to fade out before the next phase shows: the
 * veil's `--duration-fast`. */
const FADE = 400;

/** The corte's eyebrow and title, over the scene or over the drawing without WebGL. */
function Heading({ name, section }: { name: string; section: HouseSection }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="type-eyebrow text-ink-muted">Corte · {name}</p>
      <h2 id="maqueta-titulo" className="type-display-l text-ink">
        Cortada <Accent>{sectionRuns(section.plane)}</Accent>
      </h2>
    </div>
  );
}

/**
 * The house model's pinned stretch, the whole screen: the house starts as its corte, drawn in ink on
 * paper with its title at the top left, and as the scroll goes on the lens opens and the house
 * behind the cut gains depth. Going back up undoes it. The 3D loads as the stretch comes near, with
 * the corte's SVG as its poster, where the scene then draws the same corte.
 *
 * With reduced motion the scene fades from the drawing to the depth instead of moving; without
 * WebGL, the corte and the 2D plans take its place.
 */
export function HouseModel({
  name,
  plan,
  section,
  floors,
  firstStorey,
  bounds,
  skipHref,
}: HouseModelProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const area = useRef<DrawingArea | null>(null);
  const sheet = useRef<PlaceSheet | null>(null);
  const progress = useRef(0);
  const [phase, setPhase] = useState<ModelPhase>("drawing");
  const [near, setNear] = useState(false);
  const [ready, setReady] = useState(false);
  const [veiled, setVeiled] = useState(false);
  const reducedMotion = useMediaQuery(REDUCED_MOTION_QUERY);
  const mobile = useMediaQuery(MOBILE_QUERY);
  const webgl = useWebGL();
  const { resolvedTheme } = useTheme();
  const palette = modelPalettes[resolvedTheme === "dark" ? "dark" : "light"];
  const still = reducedMotion === true;
  const frame = mobile ? "compact" : "wide";

  // The 3D starts loading a screen before the stretch arrives.
  useEffect(() => {
    const element = sectionRef.current;
    if (!element || webgl !== true) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setNear(true);
        observer.disconnect();
      },
      { rootMargin: "100% 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [webgl]);

  // Where the poster draws the corte on the canvas, for the scene's camera to frame it there.
  useEffect(() => {
    const canvas = canvasRef.current;
    const drawing = areaRef.current;
    if (!canvas || !drawing) return;
    const measure = () => {
      const outer = canvas.getBoundingClientRect();
      const inner = drawing.getBoundingClientRect();
      area.current = {
        left: inner.left - outer.left,
        top: inner.top - outer.top,
        width: inner.width,
        height: inner.height,
      };
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(canvas);
    observer.observe(drawing);
    return () => observer.disconnect();
  }, [webgl]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let frame = 0;
    let veil = 0;
    let shown: ModelPhase | null = null;
    const update = () => {
      frame = 0;
      const share = trackProgress(track);
      const next = phaseAt(share);
      if (!still) {
        progress.current = share;
        setPhase(next);
        return;
      }
      // Reduced motion: the scene fades out, takes the next phase, and fades back in.
      if (next === shown) return;
      const first = shown === null;
      shown = next;
      window.clearTimeout(veil);
      const land = () => {
        progress.current = next === "drawing" ? 0 : 1;
        setPhase(next);
        setVeiled(false);
      };
      if (first) return land();
      setVeiled(true);
      veil = window.setTimeout(land, FADE);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(veil);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [still, webgl]);

  return (
    <section
      ref={sectionRef}
      aria-labelledby="maqueta-titulo"
      data-model-phase={phase}
      data-model-ready={ready || undefined}
    >
      <SkipLink href={skipHref}>Saltar la maqueta</SkipLink>
      {webgl === false ? (
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-6 md:gap-16 md:px-10">
          <Heading name={name} section={section.drawing} />
          <figure data-model-section className="-mx-4 flex flex-col gap-3 md:-mx-6">
            <SectionDrawing
              section={section.drawing}
              title={`Corte de ${name}`}
              description={section.description}
              idPrefix="maqueta-"
            />
            <figcaption className="type-small text-ink-muted">
              {name} cortada {sectionRuns(section.drawing.plane)}, con sus niveles y cotas.
            </figcaption>
          </figure>
          <FloorPlanViewer
            title="Sus plantas"
            floors={floors}
            bounds={bounds}
            partyWall={plan.partyWall}
            initialFloor={firstStorey}
          />
        </div>
      ) : (
        <div ref={trackRef} data-model-track className="h-[300svh]">
          <div className="sticky top-0 h-svh overflow-hidden">
            <div ref={canvasRef} className="absolute inset-0">
              {near && mobile !== null && (
                <div
                  data-model-veil={veiled ? "out" : "in"}
                  className={cn(
                    // A fade is what reduced motion keeps: no motion-reduce here.
                    "absolute inset-0 transition-opacity duration-(--duration-fast)",
                    veiled && "opacity-0",
                  )}
                >
                  <HouseModelScene
                    plan={plan}
                    section={section.drawing}
                    frame={frame}
                    area={area}
                    sheet={sheet}
                    progress={progress}
                    palette={palette}
                    still={still}
                    phase={phase}
                    onReady={() => setReady(true)}
                  />
                  <SectionSheet placeRef={sheet} section={section.drawing} frame={frame} />
                </div>
              )}
            </div>
            <div className="pointer-events-none absolute inset-x-0 top-0 px-6 pt-24 md:px-10 md:pt-28">
              <Heading name={name} section={section.drawing} />
            </div>
            {/* The corte as the scene first draws it, until it does: the same SVG, in the same place. */}
            <div
              ref={areaRef}
              data-model-area
              className="absolute inset-x-4 top-64 bottom-6 md:inset-x-10 md:top-72 md:bottom-10"
            >
              <div
                data-model-poster
                className={cn(
                  "size-full transition-opacity duration-(--duration-slow) motion-reduce:transition-none",
                  // Still read once the scene draws over it: the corte in words.
                  ready && "opacity-0",
                )}
              >
                <SectionDrawing
                  section={section.drawing}
                  title={`Corte de ${name}`}
                  description={section.description}
                  idPrefix="maqueta-"
                  fill
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
