"use client";

import { useEffect, useRef, useState } from "react";

/** Ignore scroll jitter smaller than this before deciding a direction. */
const SCROLL_THRESHOLD = 4;

type HeaderShellProps = {
  children: React.ReactNode;
};

/**
 * Fixed site header frame. Transparent while it sits over media: the page's `[data-header-overlay]`
 * elements (the landing hero and flight), which run from the top of the page to the end of the
 * last one. A solid panel afterwards, hidden while scrolling down and shown again when scrolling
 * up or when focus enters it.
 */
export function HeaderShell({ children }: HeaderShellProps) {
  const ref = useRef<HTMLElement>(null);
  const [hidden, setHidden] = useState(false);
  const [overMedia, setOverMedia] = useState(true);

  useEffect(() => {
    let lastY = window.scrollY;
    let frame = 0;

    const update = () => {
      frame = 0;
      const y = window.scrollY;
      const headerHeight = ref.current?.offsetHeight ?? 0;
      if (Math.abs(y - lastY) > SCROLL_THRESHOLD) {
        // Keep the header on screen for keyboard users tabbing through it, not after a click.
        const keyboardFocusInside =
          ref.current?.contains(document.activeElement) === true &&
          document.activeElement?.matches(":focus-visible") === true;
        setHidden(y > lastY && y > headerHeight && !keyboardFocusInside);
        lastY = y;
      }
      const overlay = [...document.querySelectorAll("[data-header-overlay]")].at(-1);
      setOverMedia(overlay !== undefined && overlay.getBoundingClientRect().bottom > headerHeight);
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <header
      ref={ref}
      onFocus={() => setHidden(false)}
      data-hidden={hidden || undefined}
      data-over-media={overMedia || undefined}
      className="fixed inset-x-0 top-0 z-50 border-b border-line bg-surface-raised transition-[translate,padding,background-color,border-color] duration-(--duration-base) data-hidden:-translate-y-full data-over-media:border-transparent data-over-media:bg-transparent data-over-media:pt-2 motion-reduce:transition-none md:data-over-media:pt-4"
    >
      {children}
    </header>
  );
}
