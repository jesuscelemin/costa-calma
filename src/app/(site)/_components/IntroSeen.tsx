"use client";

import { useEffect } from "react";

import { markIntroSeen } from "@/lib/intro";

/** Backs up the intro gate's mark where its inline script did not run. */
export function IntroSeen() {
  useEffect(markIntroSeen, []);
  return null;
}
