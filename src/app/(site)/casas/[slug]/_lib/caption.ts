import type { Room } from "@/features/houses/schema";

// A room's cartela as the page shows it, apart from the tour that works it out from the plan: the
// overlays read it without loading the plan module.

/** A stop's cartela: the room's name and figures from the plan, and the stop's line. */
export type Caption = {
  name: string;
  /** The floor it is on: «Planta baja». */
  floor: string;
  /** «33,6 m²». */
  area: string;
  /** «orientación suroeste». */
  orientation: string;
  /** The stop's line; a room off the tour has none. */
  line?: string;
  /** A figure of its own, if it has one: «6,4 m de altura». */
  fact?: string;
};

/** A cartela's figures in a line: «42 m² · orientación suroeste · 6,4 m de altura». */
export const captionFigures = ({ area, orientation, fact }: Caption) =>
  [area, orientation, ...(fact ? [fact] : [])].join(" · ");

/**
 * Whether a room can be entered from its picked floor: all but the garden, which is the plot round
 * the house, and a double height's void.
 */
export const canEnter = (room: Pick<Room, "kind">) =>
  room.kind !== "garden" && room.kind !== "void";

/** A stop of the tour as the page shows it: its cartela, and where its camera stands. */
export type StopView = {
  caption: Caption & { line: string };
  from: { x: number; y: number; z: number };
};
