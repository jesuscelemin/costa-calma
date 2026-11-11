// Brand motion: slow and fluid, no bounces. Mirrors the CSS variables in src/styles/tokens.css
// so Framer Motion, GSAP and CSS transitions share the same curve and timings.

export const easeCalm = [0.22, 1, 0.36, 1] as const;

/** Durations in seconds (Framer Motion and GSAP). */
export const duration = {
  fast: 0.4,
  base: 0.55,
  slow: 0.7,
  /** Images opening and titles rising, slower than the interface (ADR 0014). */
  image: 1.2,
} as const;

/** The brand curve in GSAP: cubic-bezier(0.22, 1, 0.36, 1) is the quintic ease-out, power4.out. */
export const gsapEaseCalm = "power4.out";

/** Delay between lines when a title rises line by line, in seconds. */
export const lineStagger = 0.12;
