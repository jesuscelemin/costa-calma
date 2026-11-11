"use client";

import { useRef } from "react";

import { Button } from "@/components/ui/button";
import { SkipLink } from "@/components/ui/skip-link";
import { useIntroHold } from "@/lib/use-intro-hold";
import { useScrub } from "@/lib/scrub/use-scrub";
import { MOBILE_QUERY, REDUCED_MOTION_QUERY, useMediaQuery } from "@/lib/use-media-query";
import { useSaveData } from "@/lib/use-save-data";

import { flightChapterCopy } from "../content";
import { flightManifest } from "../manifest";

import { FlightStills } from "./FlightStills";

/** Share of each chapter's scroll the camera holds still, so its text can be read. */
const HOLD = 0.4;
/** The text is fully in a little before the hold starts, and starts leaving a little after. */
const FADE = ((1 - HOLD) / 2) * 0.8;

const { chapters, sources } = flightManifest;

type FlightSectionProps = {
  id: string;
  /** Id of the section right after the flight, where "Saltar el vuelo" goes. */
  skipTo: string;
};

/**
 * The flight: a pinned, full-screen video that the scroll scrubs from the sea to the development,
 * in chapters whose text comes and goes with the camera. About 400 vh of scroll on desktop and
 * 300 vh with the vertical video on phones.
 *
 * With reduced motion, Save-Data or a clip that fails to load, it is a still per chapter instead,
 * fading with the same scroll and with the same text; the clip is then never downloaded.
 */
export function FlightSection({ id, skipTo }: FlightSectionProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const reducedMotion = useMediaQuery(REDUCED_MOTION_QUERY);
  const mobile = useMediaQuery(MOBILE_QUERY);
  const saveData = useSaveData();
  // The clip only once the browser has said it may (not on the server, nor while hydrating).
  const playsClip = reducedMotion === false && mobile !== null && !saveData;
  const source = playsClip ? sources[mobile ? "mobile" : "desktop"] : null;
  const {
    chapter: active,
    failed,
    loaded,
  } = useScrub({
    trackRef,
    videoRef,
    source,
    chapters,
    hold: HOLD,
  });
  // Until the browser has said whether there is a clip, or while it loads.
  const clipPending =
    reducedMotion === null || mobile === null || (source !== null && !loaded && !failed);
  // The landing's intro waits for it, up to its maximum.
  useIntroHold(clipPending);

  return (
    // The site header stays transparent over the flight, as over the hero.
    <section id={id} aria-labelledby={`${id}-title`} data-header-overlay>
      <h2 id={`${id}-title`} className="sr-only">
        El vuelo
      </h2>
      <SkipLink href={`#${skipTo}`}>Saltar el vuelo</SkipLink>
      <div
        ref={trackRef}
        data-scrub-track
        className="h-[300svh] md:h-[400svh]"
        style={{ "--chapter-fade": FADE } as React.CSSProperties}
      >
        <div className="sticky top-0 h-svh p-2 md:p-4">
          <div className="relative h-full overflow-hidden bg-piedra">
            {source && !failed ? (
              <video
                ref={videoRef}
                poster={source.poster}
                muted
                playsInline
                preload="auto"
                disablePictureInPicture
                disableRemotePlayback
                aria-hidden
                tabIndex={-1}
                className="absolute inset-0 size-full object-cover"
              />
            ) : (
              // Also what the server renders, and all there is without JavaScript: never a gap.
              <FlightStills active={active} />
            )}
            <div aria-hidden className="absolute inset-0 bg-scrim" />
            {/* Under the header, whose controls lie on the video in light text. */}
            <div aria-hidden className="absolute inset-x-0 top-0 h-40 bg-scrim-top" />
            {chapters.map(({ id: chapterId }, index) => {
              const { label, title, text } = flightChapterCopy[chapterId];
              return (
                <article
                  key={chapterId}
                  aria-labelledby={`${id}-${chapterId}`}
                  data-active={index === active || undefined}
                  // The scrim's text zone is the bottom 40 %: the text stays inside it.
                  className="absolute inset-x-0 bottom-0 flex max-h-[40%] max-w-4xl scrub-chapter flex-col justify-end gap-4 p-6 on-media md:p-16"
                >
                  <p className="type-eyebrow">{label}</p>
                  <h3 id={`${id}-${chapterId}`} className="type-display-l">
                    {title}
                  </h3>
                  <p className="max-w-xl type-title font-normal">{text}</p>
                  {index === chapters.length - 1 && (
                    // Only reachable while its chapter shows.
                    <div inert={index !== active} className="pt-2">
                      <Button asChild variant="outline">
                        <a href={`#${skipTo}`}>Elegir casa</a>
                      </Button>
                    </div>
                  )}
                </article>
              );
            })}
            {/* Where the flight is: the chapter and a line that fills as it goes. */}
            <div
              aria-hidden
              className="absolute right-6 bottom-6 hidden items-center gap-4 type-small on-media md:right-16 md:bottom-16 md:flex"
            >
              <span className="tabular-nums">
                {String(Math.max(active, 0) + 1).padStart(2, "0")} /{" "}
                {String(chapters.length).padStart(2, "0")}
              </span>
              <span className="relative h-px w-24 bg-on-media/30">
                <span
                  className="absolute inset-y-0 left-0 bg-on-media transition-[width] duration-(--duration-slow) ease-(--ease-calm) motion-reduce:transition-none"
                  style={{ width: `${((Math.max(active, 0) + 1) / chapters.length) * 100}%` }}
                />
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
