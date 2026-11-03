import type { CSSProperties } from "react";

import { formatLength } from "@/lib/format";
import { cn } from "@/lib/utils";

import {
  toCentimetre,
  type HouseSection,
  type SectionRoom,
  type SectionWall,
  type Stretch,
} from "../_lib/house-section";
import { WALL_HEIGHT } from "../_lib/model-geometry";
import { ADVANCE, labelLines } from "../_lib/room-label";

type SectionDrawingProps = {
  section: HouseSection;
  /** What it is, for its title: «Corte de Villa Mar». */
  title: string;
  /** The house in words, for those who cannot see the drawing. */
  description: string;
  /** Prefix for its ids, when it is drawn twice on the page. */
  idPrefix?: string;
};

export type SectionFrameId = "wide" | "compact";

// An architect's corte in ink on paper, in metres: the SVG's user unit is a metre, along the cut
// to the right (north to south, so the sea is on the right) and up, which SVG draws down, so every
// height is negated. Walls and slabs cut are poché, solid ink; the land is hatched under the
// ground line, the pool's water is the sea's soft blue.
//
// Drawn twice: the whole plot on wide screens and, on phones, from the house's first wall to the
// plot's end, without the garden behind it, with larger letters and thicker lines so it reads there.

export type SectionFrame = {
  id: SectionFrameId;
  from: number;
  to: number;
  /** Font size of the labels, in metres. */
  fontSize: number;
  /** Line weight, as a factor of the wide frame's. */
  weight: number;
  className: string;
};

/** SVG draws downwards: a height, as SVG places it. */
const svgY = (y: number) => -y;

export function sectionFrames(section: HouseSection): SectionFrame[] {
  const { terrain, dimensions } = section;
  const first = dimensions[0] ?? terrain.from;
  return [
    {
      id: "wide",
      from: terrain.from - 0.6,
      to: terrain.to + 0.6,
      fontSize: 0.3,
      weight: 1,
      className: "hidden md:block",
    },
    {
      id: "compact",
      from: first - 0.5,
      to: terrain.to + 0.3,
      fontSize: 0.56,
      weight: 1.8,
      className: "md:hidden",
    },
  ];
}

/** One of the corte's frames: the whole plot, or the house to the sea on phones. */
export const sectionFrame = (section: HouseSection, id: SectionFrameId) =>
  sectionFrames(section).find((frame) => frame.id === id)!;

/** A name in one or two lines that fit `width`, at its size or a little smaller; or nothing. */
function fitLabel(name: string, width: number, size: number) {
  for (const scale of [1, 0.85]) {
    const lines = labelLines(name, width, size * scale);
    if (lines) return { lines, size: size * scale };
  }
  return null;
}

type LabelProps = {
  x: number;
  y: number;
  lines: string[];
  size: number;
  /** A second, quieter line: a figure. */
  note?: string;
  weight: number;
};

/** Text centred on (x, y), with a halo in the paper's colour so hatching never crosses it. */
function Label({ x, y, lines, size, note, weight }: LabelProps) {
  const rows = lines.length + (note ? 1 : 0);
  const top = svgY(y) - (rows * size * 1.25) / 2 + size * 0.9;
  return (
    <text
      textAnchor="middle"
      className="stroke-surface font-sans"
      strokeWidth={0.1 * weight}
      paintOrder="stroke"
      strokeLinejoin="round"
    >
      {lines.map((line, i) => (
        <tspan
          key={i}
          x={x}
          y={top + i * size * 1.25}
          fontSize={size}
          fontWeight={600}
          className="fill-ink"
        >
          {line}
        </tspan>
      ))}
      {note && (
        <tspan
          x={x}
          y={top + lines.length * size * 1.25}
          fontSize={size * 0.85}
          className="fill-ink-muted"
        >
          {note}
        </tspan>
      )}
    </text>
  );
}

/** A wall cut, in poché, with the gap of the opening it is cut through and that opening's glass. */
function Wall({ wall, weight }: { wall: SectionWall; weight: number }) {
  const { at, thickness: t, y, height, opening, kind } = wall;
  if (kind === "railing") {
    return (
      <g className="fill-ink">
        <rect x={at - 0.015 * weight} y={svgY(y + height)} width={0.03 * weight} height={height} />
        <rect x={at - 0.05} y={svgY(y + height)} width={0.1} height={0.05} />
      </g>
    );
  }
  const pieces: Stretch[] = opening
    ? [
        { from: y, to: y + opening.sill },
        { from: y + opening.head, to: y + height },
      ]
    : [{ from: y, to: y + height }];
  const glazed = opening && (opening.kind === "window" || opening.kind === "sliding");
  return (
    <g>
      {pieces
        .filter(({ from, to }) => to - from > 0.001)
        .map(({ from, to }, i) => (
          <rect
            key={i}
            x={at - t / 2}
            y={svgY(to)}
            width={t}
            height={to - from}
            className="fill-ink"
          />
        ))}
      {glazed && (
        <g className="stroke-ink" strokeWidth={0.02 * weight}>
          {[-t / 4, t / 4].map((offset) => (
            <line
              key={offset}
              x1={at + offset}
              y1={svgY(y + opening.sill)}
              x2={at + offset}
              y2={svgY(y + opening.head)}
            />
          ))}
        </g>
      )}
    </g>
  );
}

/**
 * A level as an architect marks it: a triangle on its line, its figure and, over it, its floor's
 * name; all above the line, so nothing falls into the pool under the ground floor's.
 */
function LevelMark({
  x,
  y,
  label,
  name,
  frame,
}: {
  x: number;
  y: number;
  label: string;
  name: string | undefined;
  frame: SectionFrame;
}) {
  const r = frame.fontSize * 0.45;
  const size = frame.fontSize * 0.9;
  return (
    <g>
      <path d={`M ${x} ${svgY(y)} l ${-r} ${-r * 1.2} h ${r * 2} Z`} className="fill-ink" />
      <text
        x={x + r * 1.6}
        y={svgY(y) - r * 0.25}
        fontSize={size}
        fontWeight={600}
        className="fill-ink font-sans"
      >
        {label}
      </text>
      {name && (
        <text
          x={x + r * 1.6}
          y={svgY(y) - r * 0.25 - size * 1.15}
          fontSize={size * 0.85}
          className="fill-ink-muted font-sans"
        >
          {name}
        </text>
      )}
    </g>
  );
}

/** Where the cotas run over the house: the chain, and the overall one above it. */
function cotaHeights({ levels, walls }: HouseSection, { fontSize }: SectionFrame) {
  const top = Math.max(...levels.map(({ y }) => y), 0);
  const railing = Math.max(
    0,
    ...walls.filter((wall) => wall.y === top).map(({ height }) => height),
  );
  const chainY = top + railing + 0.6 + fontSize;
  return { chainY, totalY: chainY + fontSize * 1.8 };
}

/**
 * What a frame of the corte takes, in metres as its SVG draws them: from `x` along the cut and
 * from `y` down, which is minus the height. The model frames its camera on it.
 */
export function sectionViewBox(section: HouseSection, frame: SectionFrame) {
  const { fontSize } = frame;
  const { totalY } = cotaHeights(section, frame);
  const bottom = -section.terrain.depth - 0.5 - fontSize * 1.6;
  const y = svgY(totalY + fontSize * 1.6);
  return { x: frame.from, y, width: frame.to - frame.from, height: svgY(bottom) - y };
}

type DrawingProps = Omit<SectionDrawingProps, "title" | "description"> & {
  frame: SectionFrame;
  className: string;
  style?: CSSProperties;
} & (
    | { decorative?: false; title: string; description: string }
    /** Drawn as a picture of the one beside it, which already says what it is: hidden from readers. */
    | { decorative: true; title?: never; description?: never }
  );

/** One frame of the corte. */
export function SectionFrameDrawing({
  section,
  frame,
  title,
  description,
  idPrefix = "",
  decorative = false,
  className,
  style,
}: DrawingProps) {
  const { rooms, walls, levels, doubleHeights, overhangs, dimensions, terrain, pool, slabs } =
    section;
  const { weight, fontSize } = frame;
  const hairline = 0.02 * weight;
  const { chainY, totalY } = cotaHeights(section, frame);
  const box = sectionViewBox(section, frame);
  const viewBox = [box.x, box.y, box.width, box.height];
  const id = `${idPrefix}corte-${frame.id}`;
  const levelByFloor = new Map(levels.map((level) => [level.floor, level.y]));
  const first = dimensions[0] ?? terrain.from;
  const last = dimensions.at(-1) ?? terrain.to;
  const markX = last + 0.6;

  const roomLabel = (room: SectionRoom) => {
    const y = levelByFloor.get(room.floor);
    const rising = doubleHeights.find(
      (height) => height.room === room.id && height.floor === room.floor,
    );
    const span = rising ?? room;
    const width = span.to - span.from - 0.2;
    const label = fitLabel(room.name, width, fontSize);
    if (!label) return null;
    const x = (span.from + span.to) / 2;
    if (y === undefined) {
      // On the plot: the pool's name in its water, the rest standing on the ground, under the
      // floor that flies over it if any.
      const covered = overhangs.some(({ over }) => over.includes(room.id));
      const cy = room.kind === "pool" && pool ? (pool.water - pool.depth) / 2 : covered ? 1.3 : 0.6;
      return <Label key={room.id} x={x} y={cy} {...label} weight={weight} />;
    }
    if (rising) {
      const note = `Doble altura · ${formatLength(rising.height)}`;
      const noteFits = note.length * label.size * 0.85 * ADVANCE <= width;
      return (
        <Label
          key={room.id}
          x={x}
          y={y + rising.height / 2}
          {...label}
          note={noteFits ? note : undefined}
          weight={weight}
        />
      );
    }
    return (
      <Label
        key={room.id}
        x={x}
        y={y + (room.open ? 0.7 : WALL_HEIGHT / 2)}
        {...label}
        weight={weight}
      />
    );
  };

  const garden = { from: terrain.from, to: first };
  const gardenLabel = fitLabel("Jardín", garden.to - garden.from - 0.4, fontSize);
  const hatch = 0.28 * weight;

  return (
    <svg
      {...(decorative
        ? { "aria-hidden": true }
        : { role: "img", "aria-labelledby": `${id}-titulo`, "aria-describedby": `${id}-desc` })}
      viewBox={viewBox.join(" ")}
      className={cn("block", className)}
      style={style}
      strokeLinecap="butt"
    >
      {!decorative && (
        <>
          <title id={`${id}-titulo`}>{title}</title>
          <desc id={`${id}-desc`}>{description}</desc>
        </>
      )}
      <defs>
        <pattern
          id={`${id}-tierra`}
          width={hatch}
          height={hatch}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line
            x1={0}
            y1={0}
            x2={0}
            y2={hatch}
            strokeWidth={hairline}
            className="stroke-ink-muted"
          />
        </pattern>
      </defs>

      {/* The land, hatched, with the pool's hollow cleared out of it. */}
      <rect
        x={terrain.from}
        y={0}
        width={terrain.to - terrain.from}
        height={terrain.depth}
        fill={`url(#${id}-tierra)`}
      />
      {pool && (
        <g>
          <rect
            x={pool.from}
            y={0}
            width={pool.to - pool.from}
            height={pool.depth}
            className="fill-surface"
          />
          <rect
            x={pool.from + pool.rim}
            y={svgY(pool.water)}
            width={pool.to - pool.from - pool.rim * 2}
            height={pool.depth - pool.rim + pool.water}
            className="fill-mar-soft"
          />
          <line
            x1={pool.from + pool.rim}
            y1={svgY(pool.water)}
            x2={pool.to - pool.rim}
            y2={svgY(pool.water)}
            strokeWidth={0.03 * weight}
            className="stroke-mar"
          />
          <g className="fill-ink">
            <rect x={pool.from} y={0} width={pool.rim} height={pool.depth} />
            <rect x={pool.to - pool.rim} y={0} width={pool.rim} height={pool.depth} />
            <rect
              x={pool.from}
              y={pool.depth - pool.rim}
              width={pool.to - pool.from}
              height={pool.rim}
            />
          </g>
        </g>
      )}
      {/* The ground line, broken by the pool. */}
      <g className="stroke-ink" strokeWidth={0.05 * weight}>
        {(pool
          ? [
              { from: terrain.from, to: pool.from },
              { from: pool.to, to: terrain.to },
            ]
          : [terrain]
        )
          .filter(({ from, to }) => to > from)
          .map(({ from, to }) => (
            <line key={from} x1={from} y1={0} x2={to} y2={0} />
          ))}
      </g>
      {/* Paving on the plot: the porch. */}
      {rooms
        .filter((room) => !levelByFloor.has(room.floor) && room.kind === "deck")
        .map((room) => (
          <rect
            key={room.id}
            x={room.from}
            y={-0.06}
            width={room.to - room.from}
            height={0.06}
            className="fill-ink"
          />
        ))}

      {/* Where each floor stands, dashed from the house to its mark. */}
      <g
        className="stroke-ink-muted"
        strokeWidth={hairline}
        strokeDasharray={`${0.12 * weight} ${0.1 * weight}`}
      >
        {levels.map(({ floor, y }) => (
          <line key={floor} x1={last} y1={svgY(y)} x2={markX} y2={svgY(y)} />
        ))}
      </g>

      <g className="fill-ink">
        {slabs.map(({ floor, from, to, y, depth }) => (
          <rect key={`${floor}-${from}`} x={from} y={svgY(y)} width={to - from} height={depth} />
        ))}
      </g>
      {walls.map((wall) => (
        <Wall key={`${wall.floor}-${wall.at}`} wall={wall} weight={weight} />
      ))}

      {rooms.map(roomLabel)}
      {frame.id === "wide" && gardenLabel && (
        <Label x={(garden.from + garden.to) / 2} y={0.6} {...gardenLabel} weight={weight} />
      )}

      {levels.map(({ floor, y, label, name }) => (
        <LevelMark
          key={floor}
          x={markX}
          y={y}
          label={label}
          name={frame.id === "wide" ? name : undefined}
          frame={frame}
        />
      ))}

      {/* The cotas: wall to wall along the cut, over the house, and the whole of it above. */}
      <g className="stroke-ink" strokeWidth={hairline}>
        {[
          { y: chainY, marks: dimensions },
          { y: totalY, marks: [first, last] },
        ].map(({ y, marks }) => (
          <g key={y}>
            <line x1={first} y1={svgY(y)} x2={last} y2={svgY(y)} />
            {marks.map((at) => (
              <g key={at}>
                <line x1={at} y1={svgY(y) - 0.18} x2={at} y2={svgY(y) + 0.18} />
                <line
                  x1={at - 0.1}
                  y1={svgY(y) + 0.1}
                  x2={at + 0.1}
                  y2={svgY(y) - 0.1}
                  strokeWidth={hairline * 2}
                />
              </g>
            ))}
          </g>
        ))}
      </g>
      <text
        x={(first + last) / 2}
        y={svgY(totalY) - 0.15}
        textAnchor="middle"
        fontSize={fontSize * 0.85}
        fontWeight={600}
        className="fill-ink font-sans"
      >
        {formatLength(toCentimetre(last - first))}
      </text>
      {dimensions.slice(1).map((at, i) => {
        const from = dimensions[i]!;
        const text = formatLength(toCentimetre(at - from));
        const size = Math.min(fontSize * 0.85, ((at - from) * 0.9) / (text.length * ADVANCE));
        return (
          <text
            key={at}
            x={(from + at) / 2}
            y={svgY(chainY) - 0.15}
            textAnchor="middle"
            fontSize={size}
            className="fill-ink font-sans"
          >
            {text}
          </text>
        );
      })}

      {/* Which way it looks: the north on the left, the sea on the right. */}
      {section.plane.runs === "north-south" && (
        <g fontSize={fontSize * 0.85} fontWeight={600} className="fill-ink-muted font-sans">
          <text x={frame.from + 0.3} y={svgY(-terrain.depth) + fontSize * 1.4}>
            Norte
          </text>
          <text x={frame.to - 0.3} y={svgY(-terrain.depth) + fontSize * 1.4} textAnchor="end">
            Mar
          </text>
        </g>
      )}
    </svg>
  );
}

/**
 * A house type's corte as an architect draws it: on paper, in ink, with its levels and cotas. On a
 * sheet of its own, or filling its box, centred in it, on the page's paper.
 */
export function SectionDrawing({
  section,
  title,
  description,
  idPrefix = "",
  fill = false,
}: SectionDrawingProps & { fill?: boolean }) {
  return (
    <div
      className={cn(fill ? "h-full" : "overflow-hidden rounded-card border border-line bg-surface")}
    >
      {sectionFrames(section).map((frame) => (
        <SectionFrameDrawing
          key={frame.id}
          section={section}
          frame={frame}
          title={title}
          description={description}
          idPrefix={idPrefix}
          className={cn(fill ? "size-full" : "h-auto w-full", frame.className)}
        />
      ))}
    </div>
  );
}
