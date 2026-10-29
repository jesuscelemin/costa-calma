// Brand motion: slow and fluid, no bounces. Mirrors the CSS variables in src/styles/tokens.css
// so Framer Motion, GSAP and CSS transitions share the same curve and timings.

export const easeCalm = [0.22, 1, 0.36, 1] as const;

/** Durations in seconds (Framer Motion and GSAP). */
export const duration = {
  fast: 0.4,
  base: 0.55,
  slow: 0.7,
} as const;

/** The brand curve in GSAP: cubic-bezier(0.22, 1, 0.36, 1) is the quintic ease-out, power4.out. */
export const gsapEaseCalm = "power4.out";

/** Delay between words when a title enters word by word, in seconds. */
export const wordStagger = 0.06;
