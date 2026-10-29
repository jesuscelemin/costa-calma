export type TimelineChapter = {
  /** Seconds in the clip. */
  start: number;
  end: number;
};

export type TimelineState = {
  /** Seconds in the clip. */
  time: number;
  /** Index of the active chapter. */
  chapter: number;
  /** How far through the active chapter's scroll, 0–1. */
  chapterProgress: number;
};

const clamp = (value: number) => Math.min(Math.max(value, 0), 1);

/**
 * Share of the clip a chapter has played at a point of its scroll: it moves in to its middle
 * frame, holds there for `hold` of its scroll so its text can be read, then moves on.
 */
function clipShare(chapterProgress: number, hold: number) {
  const move = (1 - hold) / 2;
  if (chapterProgress < move) return (chapterProgress / move) * 0.5;
  if (chapterProgress <= 1 - move) return 0.5;
  return 0.5 + ((chapterProgress - (1 - move)) / move) * 0.5;
}

/**
 * Where a scroll-scrubbed sequence is at a point of its scroll (0–1): the clip time, the active
 * chapter and how far through it the scroll is. Chapters chain (each starts where the previous
 * ends) and get a share of the scroll as long as their share of the clip, so the camera keeps
 * one pace. `hold` (0–1, below 1) is the share of each chapter's scroll spent on a still frame.
 */
export function timelineAt(
  progress: number,
  chapters: readonly TimelineChapter[],
  hold: number,
): TimelineState {
  const duration = chapters[chapters.length - 1].end - chapters[0].start;
  let chapterStart = 0;

  for (const [index, { start, end }] of chapters.entries()) {
    const share = (end - start) / duration;
    const isLast = index === chapters.length - 1;
    if (progress < chapterStart + share || isLast) {
      // Summed shares drift by a hair (1/3 + 1/3 + 1/3), so the last chapter could overshoot 1.
      const chapterProgress = clamp((progress - chapterStart) / share);
      const time = start + (end - start) * clipShare(chapterProgress, hold);
      return { time, chapter: index, chapterProgress };
    }
    chapterStart += share;
  }
  throw new Error("A timeline needs at least one chapter");
}
