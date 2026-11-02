import type { RoomGeometry } from "@/features/houses/plan";
import type { Rect } from "@/features/houses/schema";

// Where a room's name and m² go on its plan, in metres. Pure, so a test can check that every room
// of every plan gets its name: a label that does not fit drops its m², then shrinks, then turns
// to run along the room's longer side, and only a stair goes without one.

/** Average advance of Manrope's letters, as a share of the font size: to fit labels in rooms. */
const ADVANCE = 0.56;

/** Steps down from the label's own size before it gives up on reading horizontally. */
const SHRINK = [1, 0.85, 0.72];

export type RoomLabelLayout = {
  lines: string[];
  /** Font size of the name, in metres. */
  size: number;
  /** The m² line and its font size, when it fits. */
  area: { text: string; size: number } | null;
  /** Centre of the label. */
  cx: number;
  cz: number;
  /** Turned a quarter, reading from the south up, along a room deeper than it is wide. */
  vertical: boolean;
};

/**
 * Splits a name in two lines at its last space that fits, or gives up. Never leaves a number or a
 * short word alone on a line ("Dormitorio / 2"): the label shrinks instead.
 */
function labelLines(name: string, width: number, size: number): string[] | null {
  const fits = (text: string) => text.length * size * ADVANCE <= width;
  if (fits(name)) return [name];
  const words = name.split(" ");
  for (let i = words.length - 1; i > 0; i--) {
    const [first, second] = [words.slice(0, i).join(" "), words.slice(i).join(" ")];
    if (first.length < 3 || second.length < 3) continue;
    if (fits(first) && fits(second)) return [first, second];
  }
  return null;
}

/** Where a room's label goes: the room less its wardrobe, which stands against one wall. */
function labelArea(room: RoomGeometry): Rect {
  const { wardrobe } = room;
  if (!wardrobe) return room;
  if (wardrobe.d >= wardrobe.w) {
    const west = wardrobe.x - room.x < room.x + room.w - (wardrobe.x + wardrobe.w);
    return west
      ? { ...room, x: wardrobe.x + wardrobe.w, w: room.x + room.w - (wardrobe.x + wardrobe.w) }
      : { ...room, w: wardrobe.x - room.x };
  }
  const north = wardrobe.z - room.z < room.z + room.d - (wardrobe.z + wardrobe.d);
  return north
    ? { ...room, z: wardrobe.z + wardrobe.d, d: room.z + room.d - (wardrobe.z + wardrobe.d) }
    : { ...room, d: wardrobe.z - room.z };
}

type LabelOptions = {
  /** The plan's scale: 1 on a 12 m frame. */
  s: number;
  /** The house's footprint, to label the garden behind it rather than under it. */
  footprint: Rect;
  /** The room's m², formatted; null on phones, where the name goes alone and larger. */
  area: string | null;
  /** Phones: the name alone, larger, so it stays legible on a narrow plan. */
  compact: boolean;
};

export function roomLabelLayout(
  room: RoomGeometry,
  { s, footprint, area, compact }: LabelOptions,
): RoomLabelLayout | null {
  // A stair says what it is with its treads.
  if (room.kind === "stair") return null;
  const box = labelArea(room);
  const pad = 0.2 * s;
  const cx = box.x + box.w / 2;
  // The garden's centre is the house: label it in the strip behind it instead.
  const cz = room.kind === "garden" ? (box.z + footprint.z) / 2 : box.z + box.d / 2;

  const orientations = box.d > box.w ? [false, true] : [false];
  for (const vertical of orientations) {
    const [width, depth] = vertical ? [box.d - pad, box.w - pad] : [box.w - pad, box.d - pad];
    for (const step of SHRINK) {
      const size = (compact ? 0.5 : 0.34) * s * step;
      const areaSize = 0.28 * s * step;
      const lines = labelLines(room.name, width, size);
      if (!lines) continue;
      const withArea = [area, null].filter(
        (text) => !text || text.length * areaSize * ADVANCE <= width,
      );
      for (const text of withArea) {
        const rows = lines.length + (text ? 1 : 0);
        if (rows * size * 1.3 > depth) continue;
        return {
          lines,
          size,
          area: text ? { text, size: areaSize } : null,
          cx,
          cz,
          vertical,
        };
      }
    }
  }
  return null;
}
