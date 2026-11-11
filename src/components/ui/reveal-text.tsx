"use client";

import { useEffect, useRef } from "react";

import { loadGsap, prefersReducedMotion } from "@/lib/gsap";
import { whenIntroLifts } from "@/lib/intro";
import { duration, gsapEaseCalm, lineStagger } from "@/lib/motion";

type RevealTextProps = {
  as: "h1" | "h2" | "h3" | "p";
  id?: string;
  className?: string;
  children: React.ReactNode;
};

/**
 * Text that enters once when it scrolls into view: its lines rise one after another from behind a
 * mask, as the Galería blanca references set their titles (ADR 0014). With reduced motion it only
 * fades in.
 *
 * Screen readers get a plain copy of the text, so it is read whole and once even mid-animation;
 * the split copy that moves is hidden from them. Until GSAP takes over that copy is hidden, and a
 * CSS fallback shows it anyway if the script never runs (see `[data-reveal]` in globals.css).
 */
export function RevealText({ as: Tag, id, className, children }: RevealTextProps) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const element = ref.current;
    const visual = element?.querySelector<HTMLElement>("[data-reveal-visual]");
    if (!element || !visual) return;
    let revert: (() => void) | undefined;
    let cancelled = false;

    // Under the landing's intro, the entry waits for the intro to lift and uncover the text.
    void Promise.all([loadGsap(), whenIntroLifts()]).then(([{ gsap, SplitText }]) => {
      if (cancelled) return;
      // GSAP arrived after the CSS fallback already showed the text: leave it, no second entry.
      if (getComputedStyle(visual).visibility === "visible") {
        element.dataset.reveal = "ready";
        return;
      }
      const context = gsap.context(() => {
        const scrollTrigger = { trigger: element, start: "top 85%", once: true };
        element.dataset.reveal = "ready";

        if (prefersReducedMotion()) {
          gsap.from(visual, { autoAlpha: 0, duration: duration.slow, ease: "none", scrollTrigger });
          return;
        }
        const { lines } = SplitText.create(visual, {
          type: "lines",
          linesClass: "line",
          mask: "lines",
          aria: "none",
        });
        gsap.from(lines, {
          yPercent: 110,
          duration: duration.image,
          ease: gsapEaseCalm,
          stagger: lineStagger,
          scrollTrigger,
        });
      }, element);
      revert = () => context.revert();
    });

    return () => {
      cancelled = true;
      revert?.();
    };
  }, []);

  return (
    <Tag
      ref={ref as React.Ref<HTMLHeadingElement & HTMLParagraphElement>}
      id={id}
      className={className}
      data-reveal=""
    >
      <span className="sr-only">{children}</span>
      <span aria-hidden data-reveal-visual>
        {children}
      </span>
    </Tag>
  );
}
