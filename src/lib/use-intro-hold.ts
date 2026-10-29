"use client";

import { useEffect } from "react";

import { holdIntro } from "./intro";

/** Holds the landing's intro while `holding` is true (see `holdIntro`). */
export function useIntroHold(holding: boolean) {
  useEffect(() => (holding ? holdIntro() : undefined), [holding]);
}
