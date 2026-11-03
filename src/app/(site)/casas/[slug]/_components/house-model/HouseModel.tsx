"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { SkipLink } from "@/components/ui/skip-link";
import type { HousePlan, Rect } from "@/features/houses/schema";
import { trackProgress } from "@/lib/scrub/use-scrub";
import { REDUCED_MOTION_QUERY, useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";

import { modelPhases, phaseAt, type ModelPhase } from "../../_lib/model-choreography";
import type { ModelChapterCopy } from "../../_lib/model-copy";
import { modelPalettes } from "../../_lib/model-palette";
import { FloorButtons } from "../FloorButtons";
import { FloorPlanDrawing } from "../FloorPlanDrawing";
import { RoomList } from "../RoomList";
import type { PlanFloorView } from "../../_lib/floor-views";

import { useWebGL } from "./use-webgl";

// Three.js, React Three Fiber, drei and postprocessing come in their own chunk, only on the client.
const HouseModelScene = dynamic(() => import("./HouseModelScene"), { ssr: false });

type HouseModelProps = {
  name: string;
  plan: HousePlan;
  copy: Record<ModelPhase, ModelChapterCopy>;
  /** Each floor's 2D plan and rooms: what shows without WebGL, and the list beside a picked floor. */
  floors: PlanFloorView[];
  /** The floor whose 2D plan shows without WebGL until another is picked: the ground floor. */
  firstStorey: string;
  bounds: Rect;
  poster: { day: string; night: string };
  /** Where the skip link goes: what follows the model. */
  skipHref: string;
};

const counter = (n: number) => String(n).padStart(2, "0");

/** With reduced motion, how long the model takes to fade out before another floor shows: the
 * veil's `--duration-fast`. */
const FADE = 400;

/**
 * The house model's pinned stretch: the text of each phase on the left (below on phones), the
 * model on the right (on top). The scroll through the stretch builds the house from its empty plot
 * to its floors apart in the air, forwards and back. The 3D loads as the stretch comes near, with
 * a poster until it draws.
 *
 * Beside it, a figure of what each phase shows. Once the house is open, a floor picked on the model
 * or with the buttons shows alone, almost from above or as its 2D plan, with its rooms listed
 * beside it.
 *
 * With reduced motion the house is already open, the stretch is not pinned and a floor fades in
 * instead of the camera flying to it; without WebGL, the 2D plan takes the model's place.
 */
export function HouseModel({
  name,
  plan,
  copy,
  floors,
  firstStorey,
  bounds,
  poster,
  skipHref,
}: HouseModelProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const progress = useRef(0);
  const [phase, setPhase] = useState<ModelPhase>("plot");
  const [near, setNear] = useState(false);
  const [ready, setReady] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [pointedRoom, setPointedRoom] = useState<string | null>(null);
  const [veiled, setVeiled] = useState(false);
  /** How the floor picked shows: the model from above, or its 2D plan. */
  const [view, setView] = useState<"3d" | "plan">("3d");
  const veil = useRef(0);
  const reducedMotion = useMediaQuery(REDUCED_MOTION_QUERY);
  const webgl = useWebGL();
  const { resolvedTheme } = useTheme();
  const palette = modelPalettes[resolvedTheme === "dark" ? "dark" : "light"];
  const still = reducedMotion === true;
  const pinned = !still && webgl !== false;
  const shown: ModelPhase = pinned ? phase : "open";
  const pickedIndex = plan.floors.findIndex(({ id }) => id === picked);
  const pickedView = floors.find(({ id }) => id === picked);
  const ground = floors.find(({ id }) => id === firstStorey) ?? floors[0]!;

  const pick = (id: string | null) => {
    setPointedRoom(null);
    if (!still) {
      setPicked(id);
      return;
    }
    // Reduced motion: the model fades out and back in on the other floor, without a flight.
    window.clearTimeout(veil.current);
    setVeiled(true);
    veil.current = window.setTimeout(() => {
      setPicked(id);
      setVeiled(false);
    }, FADE);
  };
  useEffect(() => () => window.clearTimeout(veil.current), []);

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
      const next = phaseAt(progress.current);
      setPhase(next);
      // Scrolling back into the build closes the floor picked.
      if (next !== "open") setPicked(null);
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
      data-model-floor={picked ?? undefined}
    >
      <h2 id="maqueta-titulo" className="sr-only">
        Maqueta de {name}
      </h2>
      <SkipLink href={skipHref}>Saltar la maqueta</SkipLink>
      <div
        ref={trackRef}
        data-model-track // Reduced motion is known before hydration: never tall, not even for a moment.
        className={cn(pinned && "h-[350svh] motion-reduce:h-auto md:h-[400svh]")}
      >
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
                  key={(pickedView ?? ground).id}
                  floor={pickedView ?? ground}
                  bounds={bounds}
                  partyWall={plan.partyWall}
                  pointed={pointedRoom}
                  idPrefix="maqueta-"
                />
                <figcaption className="type-small text-ink-muted">
                  {(pickedView ?? ground).summary}
                </figcaption>
              </figure>
            ) : (
              <>
                {near && (
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
                      progress={progress}
                      palette={palette}
                      still={still}
                      onReady={() => setReady(true)}
                      picked={pickedIndex === -1 ? null : pickedIndex}
                      pointedRoom={pointedRoom}
                      onPick={(index) => pick(plan.floors[index]?.id ?? null)}
                      onPointRoom={setPointedRoom}
                    />
                  </div>
                )}
                {pickedView && (
                  <>
                    {/* The floor picked as its 2D plan, over the model, which stays where it is. */}
                    <figure
                      data-model-plan
                      // Out of sight, out of reach and unread.
                      inert={view !== "plan"}
                      aria-hidden={view !== "plan" || undefined}
                      className={cn(
                        "absolute inset-0 z-30 flex flex-col justify-center gap-3 bg-surface p-4 pt-16 transition-opacity duration-(--duration-fast) md:p-8 md:pt-20",
                        view !== "plan" && "opacity-0",
                      )}
                    >
                      <FloorPlanDrawing
                        key={pickedView.id}
                        floor={pickedView}
                        bounds={bounds}
                        partyWall={plan.partyWall}
                        pointed={pointedRoom}
                        idPrefix="maqueta-"
                      />
                      <figcaption className="type-small text-ink-muted">
                        {pickedView.summary}
                      </figcaption>
                    </figure>
                    <div
                      role="group"
                      aria-label="Vista de la planta"
                      className="absolute top-3 right-3 z-40 flex rounded-full border border-line bg-surface-raised p-1"
                    >
                      {(
                        [
                          ["3d", "3D"],
                          ["plan", "Plano"],
                        ] as const
                      ).map(([id, name]) => (
                        <button
                          key={id}
                          type="button"
                          aria-pressed={view === id}
                          onClick={() => setView(id)}
                          className={cn(
                            "h-9 cursor-pointer rounded-full px-4 type-small font-semibold text-ink focus-ring transition-colors motion-reduce:transition-none",
                            view === id ? "bg-mar-soft" : "hover:bg-terracota-soft",
                          )}
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  </>
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
                const { label, figure, text } = copy[id];
                const titleId = `maqueta-${id}`;
                const listed = id === "open" && pickedView;
                return (
                  <article
                    key={id}
                    aria-labelledby={titleId}
                    data-active={id === shown || undefined}
                    // Only the phase on screen is read and reached, not all five at once.
                    inert={id !== shown}
                    className="flex min-h-0 min-w-0 flex-col gap-3 opacity-0 transition-opacity duration-(--duration-slow) [grid-area:1/1] motion-reduce:transition-none md:gap-4 data-active:opacity-100"
                  >
                    <h3 id={titleId} className="type-eyebrow text-ink-muted">
                      {counter(index + 1)} / {counter(modelPhases.length)} · {label}
                    </h3>
                    {listed ? (
                      <RoomList
                        floor={pickedView}
                        pointed={pointedRoom}
                        onPoint={setPointedRoom}
                        titleId={`maqueta-planta-${pickedView.id}`}
                        className="max-md:order-2"
                        hideTitleOnPhones
                        scrolls
                        listClassName="max-h-[16svh] md:max-h-[36svh]"
                      />
                    ) : (
                      // A figure of what is on screen, with the line that reads it.
                      <p data-model-figure className="flex flex-col gap-2 max-md:order-2">
                        <span className="type-figure text-ink">{figure}</span>
                        <span className="max-w-md type-body text-ink-muted">{text}</span>
                      </p>
                    )}
                    {id === "open" && (
                      <FloorButtons
                        label="Plantas de la maqueta"
                        floors={floors}
                        // Without WebGL, the 2D plan shows the ground floor until another is picked.
                        current={picked ?? (webgl === false ? firstStorey : null)}
                        onPick={pick}
                        // On phones, right under the model, with the rooms below them.
                        className="max-md:order-1"
                      />
                    )}
                  </article>
                );
              })}
            </div>
            {picked && shown === "open" && webgl !== false && (
              <Button variant="secondary" className="self-start" onClick={() => pick(null)}>
                Ver todas las plantas
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
