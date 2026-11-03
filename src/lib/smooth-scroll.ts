// The page's smooth scroll, for code that moves the page itself: the tour's controls glide through
// Lenis like a wheel would, so the scroll-driven scenes follow it. Without Lenis (reduced motion,
// or before it starts), the browser scrolls.

type Scroller = {
  scrollTo(target: number, options?: { immediate?: boolean; duration?: number }): void;
};

let current: Scroller | null = null;

/** Lenis, as SmoothScroll starts it; null as it stops. */
export function setSmoothScroller(scroller: Scroller | null) {
  current = scroller;
}

/** How long a glide to a far point of the page takes, in seconds. */
const GLIDE = 1.6;

/** Moves the page to `top`, gliding there, or at once. */
export function scrollPageTo(top: number, { immediate = false } = {}) {
  if (!current) {
    window.scrollTo({ top, behavior: immediate ? "instant" : "smooth" });
    return;
  }
  // A native scroll may not have reached Lenis yet: start from where the page really is.
  current.scrollTo(window.scrollY, { immediate: true });
  current.scrollTo(top, { immediate, duration: GLIDE });
}
