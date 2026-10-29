// GSAP is client-only and loaded on demand, so it never weighs on the server render or the first
// load. Every caller shares one import and one plugin registration.

async function importGsap() {
  const [{ gsap }, { ScrollTrigger }, { SplitText }] = await Promise.all([
    import("gsap"),
    import("gsap/ScrollTrigger"),
    import("gsap/SplitText"),
  ]);
  gsap.registerPlugin(ScrollTrigger, SplitText);
  return { gsap, ScrollTrigger, SplitText };
}

let loading: ReturnType<typeof importGsap> | undefined;

export function loadGsap() {
  loading ??= importGsap();
  return loading;
}

export function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
