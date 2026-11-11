"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

import { houseTypeImages } from "@/features/houses/media";
import { prefersReducedMotion } from "@/lib/gsap";
import { scrollThrough, wordTint } from "@/lib/reveal";

type Segment = string | { image: string };

/** The phrase, with a small photograph of each house set between its words. */
const phrase: Segment[] = [
  "Doce casas blancas entre el pinar y el mar",
  { image: "villa-duna-blanca" },
  "hechas de luz, piedra y madera",
  { image: "casa-pinar" },
  "para vivir el Mediterráneo",
  { image: "casa-olivo" },
  "todo el año.",
];

const words = phrase.flatMap((segment) => (typeof segment === "string" ? segment.split(" ") : []));

/**
 * The phrase between the flight and the house types (ADR 0014): its words tint one after another
 * from ink-muted to ink as it scrolls up the screen, with the houses' photographs inline. Screen
 * readers get it whole; the scroll only listens while it is on screen, and with reduced motion it
 * is simply ink (`[data-tint-word]` in globals.css).
 */
export function LandingPhrase() {
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || prefersReducedMotion()) return;
    const spans = [...element.querySelectorAll<HTMLElement>("[data-tint-word]")];
    let frame = 0;

    const update = () => {
      frame = 0;
      const progress = scrollThrough(
        element.getBoundingClientRect(),
        window.innerHeight,
        0.9,
        0.55,
      );
      spans.forEach((span, index) =>
        span.style.setProperty("--tint", String(wordTint(progress, index, spans.length))),
      );
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        window.addEventListener("scroll", onScroll, { passive: true });
        update();
      } else {
        window.removeEventListener("scroll", onScroll);
      }
    });
    observer.observe(element);
    update();

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  let wordIndex = 0;
  return (
    <div className="mx-auto w-full max-w-7xl px-6 md:px-10">
      <p ref={ref} className="max-w-5xl type-statement text-ink">
        <span className="sr-only">{words.join(" ")}</span>
        <span aria-hidden>
          {phrase.map((segment) =>
            typeof segment === "string" ? (
              segment.split(" ").map((word) => (
                <span key={wordIndex} data-tint-word="" data-index={wordIndex++}>
                  {word}{" "}
                </span>
              ))
            ) : (
              <span
                key={segment.image}
                className="relative mr-[0.25em] inline-block h-[0.72em] w-[1.3em] overflow-hidden bg-piedra align-baseline"
              >
                <Image
                  src={houseTypeImages(segment.image).card.landscape}
                  alt=""
                  fill
                  sizes="120px"
                  className="object-cover"
                />
              </span>
            ),
          )}
        </span>
      </p>
    </div>
  );
}
