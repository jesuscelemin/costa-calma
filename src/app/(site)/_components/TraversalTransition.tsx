"use client";

import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef } from "react";

import { POPSTATE_HANDLER } from "../_lib/traversal";

/** Popstate events this component dispatched itself, which the router handles as usual. */
const replayed = new WeakSet<Event>();

/** Last scroll offset of each history entry this tab has shown, by its Navigation API key. */
const entryScroll = new Map<string, number>();

/** Where the page being traversed to scrolls as it renders. */
let pendingScroll: number | null = null;

/** The Navigation API's current history entry, where the browser has it (not yet typed in TS). */
function currentEntryKey() {
  const { navigation } = window as Window & {
    navigation?: { currentEntry: { key: string } | null };
  };
  return navigation?.currentEntry?.key;
}

/**
 * Gives Back and Forward between pages the same view transitions as a link (ADR 0005), the
 * house's hero morphing back into its card included.
 *
 * React renders a popstate synchronously, so the browser can restore the scroll on the new page,
 * and a synchronous render never starts a view transition. So a popstate that changes page is
 * held and replayed from a task of its own, where React renders it as an ordinary transition.
 * Meanwhile the browser has already restored the scroll, on the old page: it goes back to where
 * it was, so the old snapshot is right, and the new page scrolls as it commits, within the
 * transition. To where it was left, as recorded here: the browser saves an entry's scroll only
 * once the router has replaced its page, cut down to the new page's height. Without View
 * Transitions nothing is held. Rendered by TraversalGate, which hands it each popstate first.
 */
export function TraversalTransition() {
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);

  useLayoutEffect(() => {
    pathnameRef.current = pathname;
    if (pendingScroll === null) return;
    window.scrollTo({ top: pendingScroll, behavior: "instant" });
    pendingScroll = null;
  }, [pathname]);

  useEffect(() => {
    if (!("startViewTransition" in document)) return;
    let timer = 0;

    // Scroll events arrive a frame late: one caused by a page change counts for the new entry.
    const onScroll = () => {
      const key = currentEntryKey();
      if (key) entryScroll.set(key, window.scrollY);
    };

    const onPopState = (event: PopStateEvent) => {
      // Same page, such as a landing anchor: nothing for a transition to carry.
      if (replayed.has(event) || location.pathname === pathnameRef.current) return;
      event.stopImmediatePropagation();
      const from = window.scrollY;
      const key = currentEntryKey();
      clearTimeout(timer);
      timer = window.setTimeout(() => {
        pendingScroll = (key === undefined ? undefined : entryScroll.get(key)) ?? window.scrollY;
        window.scrollTo({ top: from, behavior: "instant" });
        const replay = new PopStateEvent("popstate", { state: event.state });
        replayed.add(replay);
        window.dispatchEvent(replay);
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    // Called ahead of the router's own listener (TraversalGate).
    window[POPSTATE_HANDLER] = onPopState;
    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
      delete window[POPSTATE_HANDLER];
    };
  }, []);

  return null;
}
