import { describe, expect, test } from "vitest";

import { timelineAt } from "./timeline";

// Three 4 s chapters, like the flight. Each takes a third of the scroll; with a hold of 0.5 the
// first quarter of a chapter's scroll moves in, the middle half holds and the last quarter moves on.
const chapters = [
  { start: 0, end: 4 },
  { start: 4, end: 8 },
  { start: 8, end: 12 },
];
const hold = 0.5;

describe("the scrub timeline", () => {
  test("starts at the first frame of the first chapter", () => {
    expect(timelineAt(0, chapters, hold)).toEqual({ time: 0, chapter: 0, chapterProgress: 0 });
  });

  test("ends on the last frame of the last chapter", () => {
    expect(timelineAt(1, chapters, hold)).toEqual({ time: 12, chapter: 2, chapterProgress: 1 });
  });

  test("holds the frame in the middle of a chapter while its scroll goes on", () => {
    // The first chapter holds from 1/12 to 3/12 of the scroll, on its middle frame (2 s).
    for (const progress of [1 / 12, 0.1, 1 / 6, 0.2, 3 / 12]) {
      expect(timelineAt(progress, chapters, hold).time).toBeCloseTo(2);
    }
    expect(timelineAt(0.1, chapters, hold).chapterProgress).toBeCloseTo(0.3);
    expect(timelineAt(0.2, chapters, hold).chapterProgress).toBeCloseTo(0.6);
  });

  test("moves the camera at an even pace on either side of a hold", () => {
    // Halfway into the move-in (1/24) and halfway through the move-on (7/24) of the first chapter.
    expect(timelineAt(1 / 24, chapters, hold).time).toBeCloseTo(1);
    expect(timelineAt(7 / 24, chapters, hold).time).toBeCloseTo(3);
  });

  test("hands over to the next chapter on the frame where the previous one ends", () => {
    const justBefore = timelineAt(1 / 3 - 1e-9, chapters, hold);
    expect(justBefore.chapter).toBe(0);
    expect(justBefore.chapterProgress).toBeCloseTo(1);
    expect(justBefore.time).toBeCloseTo(4);

    const onTheBorder = timelineAt(1 / 3, chapters, hold);
    expect(onTheBorder.chapter).toBe(1);
    expect(onTheBorder.chapterProgress).toBeCloseTo(0);
    expect(onTheBorder.time).toBeCloseTo(4);

    expect(timelineAt(2 / 3, chapters, hold).chapter).toBe(2);
  });

  test("gives a longer chapter a longer stretch of scroll", () => {
    // 2 s then 6 s: the first chapter takes a quarter of the scroll, the second the rest.
    const uneven = [
      { start: 0, end: 2 },
      { start: 2, end: 8 },
    ];
    expect(timelineAt(0.125, uneven, hold)).toEqual({ time: 1, chapter: 0, chapterProgress: 0.5 });
    expect(timelineAt(0.25, uneven, hold)).toEqual({ time: 2, chapter: 1, chapterProgress: 0 });
    expect(timelineAt(0.625, uneven, hold)).toEqual({ time: 5, chapter: 1, chapterProgress: 0.5 });
  });

  test("keeps scroll outside the sequence on its first and last frames", () => {
    // Overscroll (rubber banding) or the section not yet reached.
    expect(timelineAt(-0.5, chapters, hold)).toEqual({ time: 0, chapter: 0, chapterProgress: 0 });
    expect(timelineAt(1.5, chapters, hold)).toEqual({ time: 12, chapter: 2, chapterProgress: 1 });
  });

  test("without a hold, the camera never stops", () => {
    expect(timelineAt(1 / 6, chapters, 0).time).toBeCloseTo(2);
    expect(timelineAt(0.1, chapters, 0).time).toBeCloseTo(1.2);
  });
});
