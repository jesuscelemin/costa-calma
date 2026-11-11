// The pure timing behind the Galería blanca motion pieces (ADR 0014): figures that count up,
// blinds that open one after another and a phrase that tints word by word with the scroll. The
// components in components/ui only read these, so the timing is tested here, not in a browser.

import { easeCalm } from "./motion";

/** How long a figure counts up, in ms. */
export const COUNT_UP_MS = 1600;
/** Delay between one blind and the next, in ms. */
export const BLIND_STAGGER_MS = 90;

/** cubic-bezier(x1, y1, x2, y2) at time t, solved for x by Newton's method. */
function cubicBezier([x1, y1, x2, y2]: readonly [number, number, number, number], t: number) {
  const axis = (a: number, b: number, s: number) =>
    3 * a * s * (1 - s) ** 2 + 3 * b * s ** 2 * (1 - s) + s ** 3;
  const slope = (a: number, b: number, s: number) =>
    3 * a * (1 - s) ** 2 + 6 * (b - a) * s * (1 - s) + 3 * (1 - b) * s ** 2;
  let s = t;
  for (let i = 0; i < 8; i++) {
    const d = slope(x1, x2, s);
    if (Math.abs(d) < 1e-6) break;
    s -= (axis(x1, x2, s) - t) / d;
    s = Math.min(Math.max(s, 0), 1);
  }
  return axis(y1, y2, s);
}

const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1);

/** The brand curve, cubic-bezier(0.22, 1, 0.36, 1), at progress 0–1. */
export function easeCalmAt(progress: number) {
  const t = clamp01(progress);
  if (t === 0 || t === 1) return t;
  return cubicBezier(easeCalm, t);
}

/** Decimals a figure is shown with: as many as its target has, so 4 counts 0, 1, 2, 3, 4. */
function decimalsOf(value: number) {
  const [, fraction = ""] = String(value).split(".");
  return fraction.length;
}

/**
 * The value a figure shows `elapsed` ms after it starts counting up to `target`: eased, rounded
 * to the target's decimals, and exactly the target from `duration` on.
 */
export function countUpAt(target: number, elapsed: number, duration = COUNT_UP_MS) {
  if (duration <= 0 || elapsed >= duration) return target;
  const factor = 10 ** decimalsOf(target);
  return Math.round(target * easeCalmAt(elapsed / duration) * factor) / factor;
}

/** When blind `index` of `count` starts to open, in ms: from the first to the last, in order. */
export function blindDelay(index: number, stagger = BLIND_STAGGER_MS) {
  return Math.max(index, 0) * stagger;
}

/**
 * How tinted word `index` of `count` is (0 muted, 1 ink) at `progress` 0–1 through the phrase's
 * scroll: the words tint one after another, each over an equal share of the way, so the phrase is
 * all muted at 0 and all ink at 1.
 */
export function wordTint(progress: number, index: number, count: number) {
  if (count <= 0) return 1;
  return clamp01(clamp01(progress) * count - index);
}

/**
 * How far an element has scrolled through the viewport, 0–1: 0 while its top is still at or
 * below `start` (a fraction of the viewport from the top), 1 once its bottom reaches `end`.
 */
export function scrollThrough(
  rect: { top: number; height: number },
  viewportHeight: number,
  start = 0.85,
  end = 0.5,
) {
  const from = viewportHeight * start;
  const to = viewportHeight * end - rect.height;
  if (from === to) return rect.top <= to ? 1 : 0;
  return clamp01((from - rect.top) / (from - to));
}
