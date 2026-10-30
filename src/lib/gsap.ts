// GSAP is client-only and loaded on demand, so it never weighs on the server render or the first
// load. Every caller shares one import and one plugin registration.

import { REDUCED_MOTION_QUERY } from "./use-media-query";

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

/**
 * GSAP and its plugins, with ScrollTrigger's scroll offset up to date. ScrollTrigger caches the
 * offset until a scroll event, and a page change scrolls the window to the top and mounts the new
 * page's triggers before that event arrives: a new trigger's first refresh would then put the
 * page back at the previous page's offset.
 */
export async function loadGsap() {
  loading ??= importGsap();
  const modules = await loading;
  modules.ScrollTrigger.update();
  return modules;
}

export function prefersReducedMotion() {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}
