// Brand motion: slow and fluid, no bounces. Mirrors the CSS variables in src/styles/tokens.css
// so Framer Motion, GSAP and CSS transitions share the same curve and timings.

export const easeCalm = [0.22, 1, 0.36, 1] as const;

/** Durations in seconds (Framer Motion and GSAP). */
export const duration = {
  fast: 0.4,
  base: 0.55,
  slow: 0.7,
} as const;
