"use client";

import { useRef } from "react";

import { Accent } from "@/components/ui/accent";
import { useScrub } from "@/lib/scrub/use-scrub";

import { flightChapterCopy } from "../content";
import { flightManifest } from "../manifest";

/** Share of each chapter's scroll the camera holds still, so its text can be read. */
const HOLD = 0.4;
/** The text is fully in a little before the hold starts, and starts leaving a little after. */
const FADE = ((1 - HOLD) / 2) * 0.8;

const { chapters, sources } = flightManifest;

type FlightSectionProps = {
  id: string;
};

/**
 * The flight: a pinned, full-screen video that the scroll scrubs from the sea to the development,
 * in chapters whose text comes and goes with the camera. About 400 vh of scroll on desktop.
 */
export function FlightSection({ id }: FlightSectionProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { chapter: active } = useScrub({
    trackRef,
    videoRef,
    source: sources.desktop,
    chapters,
    hold: HOLD,
  });

  return (
    <section id={id} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="sr-only">
        El vuelo
      </h2>
      <div
        ref={trackRef}
        data-scrub-track
        className="h-[400svh]"
        style={{ "--chapter-fade": FADE } as React.CSSProperties}
      >
        <div className="sticky top-0 h-svh p-2 md:p-4">
          <div className="relative h-full overflow-hidden rounded-hero bg-arena">
            <video
              ref={videoRef}
              poster={sources.desktop.poster}
              muted
              playsInline
              preload="auto"
              disablePictureInPicture
              disableRemotePlayback
              aria-hidden
              tabIndex={-1}
              className="absolute inset-0 size-full object-cover"
            />
            <div aria-hidden className="absolute inset-0 bg-scrim" />
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
                  <p className="type-eyebrow">
                    {String(index + 1).padStart(2, "0")} /{" "}
                    {String(chapters.length).padStart(2, "0")} · {label}
                  </p>
                  <h3 id={`${id}-${chapterId}`} className="type-display-l">
                    {title.lead} <Accent>{title.accent}</Accent>
                  </h3>
                  <p className="max-w-xl type-title font-normal">{text}</p>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
