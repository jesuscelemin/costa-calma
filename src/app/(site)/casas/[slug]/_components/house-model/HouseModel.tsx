"use client";

import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";

import { Accent } from "@/components/ui/accent";
import { SkipLink } from "@/components/ui/skip-link";
import { floorGeometry } from "@/features/houses/plan";
import type { HousePlan, Rect } from "@/features/houses/schema";
import { formatArea, formatLevel, formatNumber } from "@/lib/format";
import { trackProgress } from "@/lib/scrub/use-scrub";
import { scrollPageTo } from "@/lib/smooth-scroll";
import { MOBILE_QUERY, REDUCED_MOTION_QUERY, useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";

import type { PlanFloorView } from "../../_lib/floor-views";
import { sectionRuns, type HouseSection } from "../../_lib/house-section";
import {
  modelUnits,
  phaseAt,
  stopAt,
  stopProgress,
  type ModelPhase,
} from "../../_lib/model-choreography";
import { tourStops } from "../../_lib/tour";
import { modelPalettes } from "../../_lib/model-palette";
import { FloorPlanViewer } from "../FloorPlanViewer";
import { SectionDrawing } from "../SectionDrawing";

import { TourOverlay } from "./TourOverlay";
import type { DrawingArea, HudReading, ShowHud } from "./HouseModelScene";
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

/** How tall a unit of the stretch is (a metre walked, ADR 0010), in screen heights over 100. */
const SVH_PER_UNIT = 18;

/** The sheet's eyebrow, title and line, over the scene or over the corte without WebGL. */
function Heading({ name }: { name: string }) {
  return (
    <div className="flex max-w-md flex-col gap-3">
      <p className="type-eyebrow text-ink-muted">Planta baja · {name}</p>
      <h2 id="maqueta-titulo" className="type-display-l text-ink">
        De la puerta al <Accent>mar</Accent>
      </h2>
      <p className="max-w-sm text-ink-muted max-md:type-small md:type-body">
        En línea recta, de la puerta norte a la piscina. Este plano es la casa: baja con el scroll y
        entra por la puerta.
      </p>
    </div>
  );
}

/** «Lente 2,0° · Altura 716 m · Corte +1,20 m», as the camera has it. */
function hudText({ fov, height, cut }: HudReading) {
  const lens = `Lente ${formatNumber(Math.round(fov * 10) / 10)}°`;
  const altitude = `Altura ${formatNumber(height < 10 ? Math.round(height * 100) / 100 : Math.round(height))}\u00a0m`;
  const section = cut === null ? "Sin corte" : `Corte ${formatLevel(cut)}\u00a0m`;
  return [lens, altitude, section].join(" · ");
}

/** The ground floor's rooms in words, for those who cannot see the sheet. */
function describeSheet(name: string, plan: HousePlan) {
  const ground = plan.floors.find(({ kind }) => kind !== "plot");
  if (!ground) return "";
  const rooms = floorGeometry(ground, plan)
    .rooms.filter(({ kind }) => kind !== "void")
    .map(({ name, area }) => `${name.toLocaleLowerCase("es-ES")}, ${formatArea(area)}`);
  return `Plano de la planta baja de ${name}, visto desde arriba, con la puerta al norte: ${rooms.join("; ")}.`;
}

/**
 * The house model's pinned stretch, the whole screen: the house starts as its corte, drawn in ink on
 * paper with its title at the top left, and as the scroll goes on the lens opens and the house
 * behind the cut gains depth, then the sweep turns its ink into materials and light. Going back up
 * undoes it. The 3D loads as the stretch comes near, with the corte's SVG as its poster, where
 * the scene then draws the same corte.
 *
 * With reduced motion the scene fades from the drawing to the depth, and to colour, instead of
 * moving; without WebGL, the corte and the 2D plans take its place.
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
  const hud = useRef<ShowHud | null>(null);
  const hudRef = useRef<HTMLParagraphElement>(null);
  const progress = useRef(0);
  const [phase, setPhase] = useState<ModelPhase>("sheet");
  const [stop, setStop] = useState<number | null>(null);
  const [near, setNear] = useState(false);
  const [ready, setReady] = useState(false);
  const [veiled, setVeiled] = useState(false);
  const reducedMotion = useMediaQuery(REDUCED_MOTION_QUERY);
  const mobile = useMediaQuery(MOBILE_QUERY);
  const webgl = useWebGL();
  const { resolvedTheme } = useTheme();
  const palette = modelPalettes[resolvedTheme === "dark" ? "dark" : "light"];
  const still = reducedMotion === true;
  const stops = tourStops(plan);
  const touring = phase === "tour" && stops.length > 0;

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
    let shown: string | null = null;
    const update = () => {
      frame = 0;
      const share = trackProgress(track);
      const next = phaseAt(share, plan);
      const nextStop = stopAt(share, plan, { still });
      if (!still) {
        progress.current = share;
        setPhase(next);
        setStop(nextStop);
        return;
      }
      // Reduced motion: the scene fades out, takes the next phase or stop, and fades back in.
      const key = `${next}:${nextStop}`;
      if (key === shown) return;
      const first = shown === null;
      shown = key;
      window.clearTimeout(veil);
      const land = () => {
        // Any point of a phase is its destination with reduced motion: the choreography lands it.
        progress.current = share;
        setPhase(next);
        setStop(nextStop);
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
  }, [still, webgl, plan]);

  // The HUD follows the camera, frame by frame, without rendering the page.
  useEffect(() => {
    hud.current = (reading) => {
      const element = hudRef.current;
      if (element) element.textContent = hudText(reading);
    };
    return () => {
      hud.current = null;
    };
  }, []);

  /** Takes the page to a stop's place in the stretch: gliding there, or at once without motion. */
  const goTo = (index: number) => {
    const track = trackRef.current;
    if (!track || index < 0 || index >= stops.length) return;
    const top = track.getBoundingClientRect().top + window.scrollY;
    const travel = track.offsetHeight - window.innerHeight;
    scrollPageTo(top + travel * stopProgress(index, plan), { immediate: still });
  };

  // On the tour, the arrow keys go to the stop before and the one after.
  useEffect(() => {
    if (!touring) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.closest("input, textarea, select, [contenteditable]")
      ) {
        return;
      }
      const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
      if (!step || stop === null) return;
      event.preventDefault();
      goTo(stop + step);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <section
      ref={sectionRef}
      aria-labelledby="maqueta-titulo"
      data-model-phase={phase}
      data-model-stop={stop ?? undefined}
      data-model-ready={ready || undefined}
    >
      <SkipLink href={skipHref}>Saltar la maqueta</SkipLink>
      {webgl === false ? (
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-6 md:gap-16 md:px-10">
          <Heading name={name} />
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
        <div
          ref={trackRef}
          data-model-track
          style={{ height: `${Math.round(modelUnits(plan) * SVH_PER_UNIT)}svh` }}
        >
          <div className="sticky top-0 h-svh overflow-hidden">
            <div ref={canvasRef} className="absolute inset-0">
              {near && mobile !== null && (
                <div
                  data-model-veil={veiled ? "out" : "in"}
                  className={cn(
                    // A fade is what reduced motion keeps: no motion-reduce here.
                    "absolute inset-0 transition-opacity duration-(--duration-fast)",
                    (veiled || !ready) && "opacity-0",
                  )}
                >
                  <HouseModelScene
                    plan={plan}
                    name={name}
                    area={area}
                    hud={hud}
                    progress={progress}
                    palette={palette}
                    still={still}
                    phase={phase}
                    mobile={mobile}
                    onReady={() => setReady(true)}
                  />
                </div>
              )}
            </div>
            {/* Where the sheet frames the plan: beside the title, or under it on a phone. */}
            <div
              ref={areaRef}
              data-model-area
              role="img"
              aria-label={`Plano de la planta baja de ${name}`}
              aria-describedby="maqueta-hoja"
              className="absolute inset-x-4 top-[22rem] bottom-6 md:top-20 md:right-6 md:bottom-16 md:left-[34%]"
            />
            <p id="maqueta-hoja" className="sr-only">
              {describeSheet(name, plan)}
            </p>
            <div
              className={cn(
                "pointer-events-none absolute inset-x-0 top-0 px-6 pt-24 transition-opacity duration-(--duration-slow) motion-reduce:transition-none md:px-10 md:pt-28",
                // As the walls rise, the sheet's title gives way to the house.
                phase !== "sheet" && "opacity-0",
              )}
            >
              <Heading name={name} />
            </div>
            <p
              aria-hidden
              className={cn(
                "pointer-events-none absolute inset-x-0 bottom-8 text-center type-eyebrow text-ink-muted transition-opacity duration-(--duration-slow) motion-reduce:transition-none",
                phase !== "sheet" && "opacity-0",
              )}
            >
              <span className="border-b border-ink-muted pb-1">Baja con el scroll para entrar</span>
            </p>
            <p
              ref={hudRef}
              data-model-hud
              aria-hidden
              // On a phone the title and the locator have the top of the screen.
              className="rounded-pill pointer-events-none absolute top-24 right-10 hidden border border-line bg-surface-raised px-3 py-1.5 type-eyebrow text-ink tabular-nums md:block"
            />
            {stops.length > 0 && (
              <TourOverlay
                section={section.drawing}
                stops={stops}
                stop={stop}
                touring={touring && ready}
                onGo={goTo}
              />
            )}
          </div>
        </div>
      )}
    </section>
  );
}
