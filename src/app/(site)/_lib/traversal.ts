// Back and Forward between pages with view transitions (TraversalTransition). The router listens
// for popstate from the moment it hydrates, before this site's components do, so a listener added
// by the inline script below, as the page is parsed, is the only one that runs ahead of it. It
// hands each popstate to the handler TraversalTransition installs, once there is one.

/** Window property holding the popstate handler. */
export const POPSTATE_HANDLER = "__costaCalmaPopState";

declare global {
  interface Window {
    [POPSTATE_HANDLER]?: (event: PopStateEvent) => void;
  }
}

/** Runs inline before the app, so it is stringified: it cannot use anything from outside. */
function traversalGate(handler: typeof POPSTATE_HANDLER) {
  window.addEventListener("popstate", (event) => window[handler]?.(event));
}

export const traversalGateScript = `(${traversalGate.toString()})(${JSON.stringify(POPSTATE_HANDLER)})`;
