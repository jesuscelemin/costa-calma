"use client";

import { useEffect, useRef } from "react";

import { loadGsap, prefersReducedMotion } from "@/lib/gsap";
import { whenIntroLifts } from "@/lib/intro";
import { duration, gsapEaseCalm, wordStagger } from "@/lib/motion";

type RevealTextProps = {
  as: "h1" | "h2" | "h3" | "p";
  id?: string;
  className?: string;
  children: React.ReactNode;
};

/**
 * Text that enters once when it scrolls into view: its words rise one after another from behind a
 * mask, and the accent word comes last. With reduced motion it only fades in.
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
        const { words } = SplitText.create(visual, {
          type: "words",
          wordsClass: "word",
          mask: "words",
          aria: "none",
        });
        // Accent words enter last, and so does punctuation right after them ("sin prisa.").
        const accent = new Set<Element>();
        words.forEach((word, i) => {
          const trailsAccent = accent.has(words[i - 1]) && /^\p{P}+$/u.test(word.textContent);
          if (word.closest(".type-accent") || trailsAccent) accent.add(word);
        });
        gsap.from([...words.filter((w) => !accent.has(w)), ...accent], {
          yPercent: 110,
          duration: duration.slow,
          ease: gsapEaseCalm,
          stagger: wordStagger,
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
