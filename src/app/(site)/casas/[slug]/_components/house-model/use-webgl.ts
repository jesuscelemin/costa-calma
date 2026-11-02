"use client";

import { useSyncExternalStore } from "react";

let supported: boolean | undefined;

/** Whether the browser can draw WebGL 2, asked once. */
function canDrawWebGL() {
  if (supported === undefined) {
    try {
      const context = document.createElement("canvas").getContext("webgl2");
      supported = context !== null;
      context?.getExtension("WEBGL_lose_context")?.loseContext();
    } catch {
      supported = false;
    }
  }
  return supported;
}

const subscribe = () => () => {};

/** Whether the model can be drawn; `null` on the server and while hydrating. */
export function useWebGL() {
  return useSyncExternalStore(subscribe, canDrawWebGL, () => null);
}
