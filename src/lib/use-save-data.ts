"use client";

import { useSyncExternalStore } from "react";

/** Network Information API: not in every browser, nor in TypeScript's DOM types. */
type Connection = EventTarget & { saveData?: boolean };

function connection() {
  return (navigator as Navigator & { connection?: Connection }).connection;
}

/** Whether the visitor has asked to save data (Chrome's Save-Data, Lite mode). */
export function useSaveData() {
  return useSyncExternalStore(
    (onChange) => {
      connection()?.addEventListener("change", onChange);
      return () => connection()?.removeEventListener("change", onChange);
    },
    () => connection()?.saveData === true,
    () => false,
  );
}
