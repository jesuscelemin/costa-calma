// The model's stretch in a few numbers: where each phase starts, when each stop's cartela comes on
// and where its controls take the page. The choreography works them out from the plan (on the
// server); the page scrolls by them without loading the choreography, which comes with the scene.

/** The stretch's phases, in order. */
export const modelPhases = [
  /** The ground floor from straight above, as a plan in ink. */
  { id: "sheet" },
  /** The cut rises and the walls grow; the camera tips back. */
  { id: "lift" },
  /** The lens opens, the camera comes down and lands in front of the door. */
  { id: "descent" },
  /** On foot: in through the door and from stop to stop. */
  { id: "tour" },
  /** From the last stop, the camera rises over the whole house in colour, its roof off. */
  { id: "finale" },
] as const;

/** The phases the scroll goes through. */
export type ScrollPhase = (typeof modelPhases)[number]["id"];
/** And past its end, a floor picked from the whole house, and a room of it entered. */
export type ModelPhase = ScrollPhase | "floor" | "room";

/** The stretch, in units from its start (a metre walked is one). */
export type ScrollMarks = {
  /** The stretch's length: the page gives it its height from this. */
  total: number;
  /** Where each phase starts. */
  starts: Record<ScrollPhase, number>;
  /** When each stop's cartela comes on, stop by stop. */
  shown: number[];
  /** The middle of each stop's hold, in the order the tour walks them. */
  holds: { stop: number; middle: number }[];
};

const clamp = (value: number) => Math.min(Math.max(value, 0), 1);

/** How far short of a stop's middle, in units, the page may land and still be at it. */
const PIXEL_SLACK = 0.25;

/** The units a point of the stretch stands for with reduced motion: its phase's or stop's end. */
function stillUnits({ starts, total, holds }: ScrollMarks, units: number) {
  if (units < starts.lift) return 0;
  if (units < starts.descent) return starts.descent - 1e-6;
  if (units < starts.tour) return starts.tour;
  if (units >= starts.finale) return total;
  // On foot: the stop on screen, settled, from its hold's middle to the next one's. A little short
  // of a stop's middle is that stop: the page lands on whole pixels. Before the first stop's middle
  // there is only the first stop.
  let pick = holds[0];
  for (const hold of holds) if (units >= hold.middle - PIXEL_SLACK) pick = hold;
  return pick ? pick.middle : starts.tour;
}

/** The units a share of the scroll (0–1) stands for: with reduced motion, where it settles. */
export function unitsAt(progress: number, marks: ScrollMarks, still = false) {
  // Rounded off at a phase's start: 9 · (1/9) is 9 again.
  const raw = Math.round(clamp(progress) * marks.total * 1e9) / 1e9;
  return still ? stillUnits(marks, raw) : raw;
}

/** The phase a number of units into the stretch is in. */
export function phaseUnder({ starts }: ScrollMarks, units: number): ScrollPhase {
  return [...modelPhases].reverse().find(({ id }) => units >= starts[id])!.id;
}

/** The stop whose cartela is on a number of units into the stretch, if any. */
export function stopUnder({ starts, shown }: ScrollMarks, units: number) {
  if (units < starts.tour || units >= starts.finale) return null;
  let stop: number | null = null;
  shown.forEach((from, index) => {
    if (units >= from) stop = index;
  });
  return stop;
}

/** The phase a point of the scroll (0–1) is in. */
export const phaseOf = (progress: number, marks: ScrollMarks) =>
  phaseUnder(marks, unitsAt(progress, marks));

/** The stop on screen at a point of the scroll, or none before the tour reaches one. */
export const stopOf = (progress: number, marks: ScrollMarks, { still = false } = {}) =>
  stopUnder(marks, unitsAt(progress, marks, still));

/** Where in the scroll a stop holds, in its middle: where its controls take the page. */
export function stopMiddle(index: number, marks: ScrollMarks) {
  const stop = Math.min(Math.max(index, 0), marks.shown.length - 1);
  const hold = marks.holds.find((one) => one.stop === stop);
  return hold ? hold.middle / marks.total : 1;
}
