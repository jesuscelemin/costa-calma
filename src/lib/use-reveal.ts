"use client";

import { useEffect, type RefObject } from "react";

import { whenIntroLifts } from "./intro";

/**
 * Marks `ref`'s element `data-state="in"` the first time it scrolls into view, after the landing's
 * intro lifts, and calls `onEnter` once. If it is already on screen when it mounts, it is marked
 * at once. The CSS of each motion piece (globals.css) does the rest.
 * The observer stops at once: nothing runs while the piece scrolls, nor after it has entered.
 */
export function useReveal(
  ref: RefObject<HTMLElement | null>,
  onEnter?: (element: HTMLElement) => void,
  threshold = 0.15,
) {
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let observer: IntersectionObserver | undefined;
    let cancelled = false;
    // Already on screen as the page shows (a return restoring the scroll, a morph landing on
    // it): it is simply there, with no entrance to wait for.
    const { top, bottom } = element.getBoundingClientRect();
    if (element.dataset.state !== "in" && top < window.innerHeight && bottom > 0) {
      element.dataset.state = "in";
      onEnter?.(element);
      return;
    }
    // Taken over: from now on it waits for the observer, not for the CSS fallback.
    if (element.dataset.state !== "in") element.dataset.state = "out";

    void whenIntroLifts().then(() => {
      if (cancelled) return;
      observer = new IntersectionObserver(
        (entries) => {
          if (!entries.some((entry) => entry.isIntersecting)) return;
          observer?.disconnect();
          element.dataset.state = "in";
          onEnter?.(element);
        },
        { threshold },
      );
      observer.observe(element);
    });

    return () => {
      cancelled = true;
      observer?.disconnect();
    };
    // onEnter is read once, when the piece enters: a new one per render must not restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, threshold]);
}
