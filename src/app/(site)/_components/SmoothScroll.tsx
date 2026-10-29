"use client";

import { useEffect } from "react";

import { loadGsap, prefersReducedMotion } from "@/lib/gsap";

/** Same-page anchor the click should scroll to, or null to let the browser handle it. */
function anchorTarget(event: MouseEvent) {
  if (event.defaultPrevented || event.button !== 0) return null;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;
  const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
  if (!(link instanceof HTMLAnchorElement) || link.target) return null;
  const url = new URL(link.href);
  if (url.origin !== location.origin || url.pathname !== location.pathname || !url.hash) {
    return null;
  }
  const target = document.getElementById(decodeURIComponent(url.hash.slice(1)));
  return target ? { url, target } : null;
}

/** Focuses the target, making it focusable just for this if it is not (a section, say). */
function focusWithoutScrolling(target: HTMLElement) {
  if (!target.hasAttribute("tabindex")) {
    target.setAttribute("tabindex", "-1");
    target.addEventListener("blur", () => target.removeAttribute("tabindex"), { once: true });
  }
  target.focus({ preventScroll: true });
}

/**
 * Smooth scroll for the public site: Lenis, driven by GSAP's ticker so ScrollTrigger animations
 * stay in step with it. Same-page anchors glide through Lenis, which honours each section's
 * scroll-margin-top. With reduced motion nothing starts and the browser's own scroll remains.
 */
export function SmoothScroll() {
  useEffect(() => {
    if (prefersReducedMotion()) return;
    let cleanup: (() => void) | undefined;
    let cancelled = false;

    void Promise.all([loadGsap(), import("lenis")]).then(
      ([{ gsap, ScrollTrigger }, { default: Lenis }]) => {
        if (cancelled) return;
        const lenis = new Lenis({ autoRaf: false });
        const raf = (time: number) => lenis.raf(time * 1000);
        lenis.on("scroll", ScrollTrigger.update);
        gsap.ticker.add(raf);
        gsap.ticker.lagSmoothing(0);

        const onClick = (event: MouseEvent) => {
          const anchor = anchorTarget(event);
          if (!anchor) return;
          event.preventDefault();
          history.pushState(null, "", anchor.url.hash);
          // A native scroll (scrollbar drag, scrollIntoView) may not have reached Lenis yet;
          // start from where the page really is, or the target is measured from a stale offset.
          lenis.scrollTo(window.scrollY, { immediate: true });
          lenis.scrollTo(anchor.target);
          // Like a native jump, the next Tab starts from the target.
          focusWithoutScrolling(anchor.target);
        };
        document.addEventListener("click", onClick);

        cleanup = () => {
          document.removeEventListener("click", onClick);
          gsap.ticker.remove(raf);
          gsap.ticker.lagSmoothing(500, 33);
          lenis.destroy();
        };
      },
    );

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  return null;
}
