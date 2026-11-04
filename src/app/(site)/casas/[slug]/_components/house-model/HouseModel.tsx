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

import { FloorOverlay } from "./FloorOverlay";
import { TourOverlay } from "./TourOverlay";
import type { DrawingArea, FloorRequest, HudReading, RoomKey, ShowHud } from "./HouseModelScene";
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
const SVH_PER_UNIT = 15;

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
  const floorAreaRef = useRef<HTMLDivElement>(null);
  const floorArea = useRef<DrawingArea | null>(null);
  const hud = useRef<ShowHud | null>(null);
  const hudRef = useRef<HTMLParagraphElement>(null);
  const progress = useRef(0);
  const [phase, setPhase] = useState<ModelPhase>("sheet");
  const [stop, setStop] = useState<number | null>(null);
  const [near, setNear] = useState(false);
  const [ready, setReady] = useState(false);
  const [veiled, setVeiled] = useState(false);
  const [request, setRequest] = useState<FloorRequest>({ floor: null, serial: 0, instant: false });
  const [pointed, setPointed] = useState<string | null>(null);
  /**
   * Focus goes to the floors' buttons once the whole house is on screen: after «Ir a las plantas»,
   * or «Ver la casa entera», whose button goes.
   */
  const focusFloors = useRef(false);
  /** With reduced motion, the pick waiting for the veil to be out. */
  const pickVeil = useRef(0);
  const picked = request.floor;
  const reducedMotion = useMediaQuery(REDUCED_MOTION_QUERY);
  const mobile = useMediaQuery(MOBILE_QUERY);
  const webgl = useWebGL();
  const { resolvedTheme } = useTheme();
  const palette = modelPalettes[resolvedTheme === "dark" ? "dark" : "light"];
  const still = reducedMotion === true;
  const stops = tourStops(plan);
  const touring = phase === "tour" && stops.length > 0;
  const pointedRoom: RoomKey | null = picked && pointed ? { floor: picked, room: pointed } : null;

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

  // Where the sheet and a picked floor go on the canvas, for the scene's camera to frame them there.
  useEffect(() => {
    const canvas = canvasRef.current;
    const drawing = areaRef.current;
    const floor = floorAreaRef.current;
    if (!canvas || !drawing || !floor) return;
    const within = (inner: DOMRect, outer: DOMRect): DrawingArea => ({
      left: inner.left - outer.left,
      top: inner.top - outer.top,
      width: inner.width,
      height: inner.height,
    });
    const measure = () => {
      const outer = canvas.getBoundingClientRect();
      area.current = within(drawing.getBoundingClientRect(), outer);
      floorArea.current = within(floor.getBoundingClientRect(), outer);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(canvas);
    observer.observe(drawing);
    observer.observe(floor);
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
      // Scrolled back off the whole house: whatever floor was picked, it is whole again, at once.
      if (next !== "finale") {
        window.clearTimeout(pickVeil.current);
        setRequest((known) =>
          known.floor === null ? known : { floor: null, serial: known.serial + 1, instant: true },
        );
      }
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

  /** Takes the page to a share of the stretch: gliding there, or at once without motion. */
  const scrollTo = (share: number) => {
    const track = trackRef.current;
    if (!track) return;
    const top = track.getBoundingClientRect().top + window.scrollY;
    const travel = track.offsetHeight - window.innerHeight;
    scrollPageTo(top + travel * share, { immediate: still });
  };
  /** Takes the page to a stop's place in the stretch. */
  const goTo = (index: number) => {
    if (index < 0 || index >= stops.length) return;
    scrollTo(stopProgress(index, plan));
  };
  /** «Ir a las plantas»: to the end of the stretch, the whole house. */
  const goToFloors = () => {
    focusFloors.current = true;
    scrollTo(1);
  };

  /** Picks a floor, or none for the whole house: with reduced motion, behind the veil. */
  const pick = (floor: string | null) => {
    if (floor === picked) return;
    setPointed(null);
    if (floor === null) focusFloors.current = true;
    const land = () => setRequest((known) => ({ floor, serial: known.serial + 1, instant: false }));
    if (!still) return land();
    setVeiled(true);
    window.clearTimeout(pickVeil.current);
    pickVeil.current = window.setTimeout(() => {
      land();
      setVeiled(false);
    }, FADE);
  };

  // A pick still behind the veil does not land once the section has gone.
  useEffect(() => () => window.clearTimeout(pickVeil.current), []);

  const whole = phase === "finale" && ready;

  // Once the whole house is on screen, the floors' buttons take the focus if it was asked for.
  useEffect(() => {
    // Asked for by a control, not derived: it runs as `whole` comes, whatever rendered it.
    if (!whole || !focusFloors.current) return;
    focusFloors.current = false;
    sectionRef.current
      ?.querySelector<HTMLButtonElement>("[data-floor-picker] [aria-pressed]")
      ?.focus({ preventScroll: true });
  });

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
      data-model-phase={picked ? "floor" : phase}
      data-model-floor={picked ?? undefined}
      data-model-room={pointedRoom?.room}
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
                    floorArea={floorArea}
                    phase={phase}
                    mobile={mobile}
                    request={request}
                    pointed={pointedRoom}
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
                onFloors={goToFloors}
              />
            )}
            <FloorOverlay
              name={name}
              floors={floors}
              picked={picked}
              pointed={pointed}
              shown={whole}
              onPick={pick}
              onWhole={() => pick(null)}
              onPoint={setPointed}
              areaRef={floorAreaRef}
            />
          </div>
        </div>
      )}
    </section>
  );
}
