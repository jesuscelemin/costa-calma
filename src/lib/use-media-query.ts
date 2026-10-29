"use client";

import { useSyncExternalStore } from "react";

/** Below Tailwind's `md` breakpoint: phones, which get the vertical videos. */
export const MOBILE_QUERY = "(width < 48rem)";

export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/**
 * Whether a media query matches, kept up to date. `null` on the server and while hydrating, when
 * the browser has not been asked yet.
 */
export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => null,
  );
}
