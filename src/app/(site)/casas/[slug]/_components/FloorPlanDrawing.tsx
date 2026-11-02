import type { OpeningGeometry, RoomGeometry, WallKind, WallSegment } from "@/features/houses/plan";
import type { Rect, RoomKind, Side } from "@/features/houses/schema";
import { formatArea } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { PlanFloorView } from "./FloorPlanViewer";

type FloorPlanDrawingProps = {
  floor: PlanFloorView;
  footprint: Rect;
  /** Half of a semi-detached pair: the side shared with the neighbour. */
  partyWall?: Side;
  /** The room pointed at in the list, lit on the plan. */
  pointed: string | null;
};

// An architect's ink plan, in metres: the SVG's user unit is a metre, x to the east and z (SVG's
// y) to the south, so the sea is at the bottom. Strokes and type scale with the frame, so the
// plot (22 m) reads as well as a storey (12 m).

/** Wall thickness, in metres at a 12 m frame. */
const THICKNESS: Record<WallKind, number> = {
  exterior: 0.24,
  interior: 0.1,
  railing: 0.05,
  party: 0.3,
};

const FILL: Partial<Record<RoomKind, string>> = {
  pool: "fill-mar-soft",
  garden: "fill-arena",
  deck: "fill-surface-raised",
};

/** Space around the frame for the north arrow, the scale and the sea. */
const MARGIN = 1.4;

/** Average advance of Manrope's letters, as a share of the font size: to fit labels in rooms. */
const ADVANCE = 0.56;

const key = (x: number, z: number) => `${x}:${z}`;

function Wall({ wall, s, gapEnds }: { wall: WallSegment; s: number; gapEnds: Set<string> }) {
  const t = THICKNESS[wall.kind] * s;
  // Lengthen each end by half the thickness, so corners close, except where an opening starts.
  const dx = Math.sign(wall.x2 - wall.x1) * (t / 2);
  const dz = Math.sign(wall.z2 - wall.z1) * (t / 2);
  const [x1, z1] = gapEnds.has(key(wall.x1, wall.z1))
    ? [wall.x1, wall.z1]
    : [wall.x1 - dx, wall.z1 - dz];
  const [x2, z2] = gapEnds.has(key(wall.x2, wall.z2))
    ? [wall.x2, wall.z2]
    : [wall.x2 + dx, wall.z2 + dz];
  return (
    <line
      x1={x1}
      y1={z1}
      x2={x2}
      y2={z2}
      strokeWidth={t}
      strokeDasharray={wall.kind === "railing" ? `${0.25 * s} ${0.15 * s}` : undefined}
      className={wall.kind === "railing" ? "stroke-ink-muted" : "stroke-ink"}
    />
  );
}

function Opening({ opening, s }: { opening: OpeningGeometry; s: number }) {
  const { x1, z1, x2, z2, swing } = opening;
  const along = { x: x2 - x1, z: z2 - z1 };
  const length = Math.hypot(along.x, along.z);
  // Across the wall, to draw the panes of windows and sliding doors inside its thickness.
  const n = { x: -along.z / length, z: along.x / length };
  const t = THICKNESS.exterior * s;
  const offset = (k: number) => ({ x: n.x * k, z: n.z * k });
  const pane = (k: number, from: number, to: number) => {
    const o = offset(k);
    return (
      <line
        x1={x1 + along.x * from + o.x}
        y1={z1 + along.z * from + o.z}
        x2={x1 + along.x * to + o.x}
        y2={z1 + along.z * to + o.z}
      />
    );
  };

  switch (opening.kind) {
    case "window":
      return (
        <g className="stroke-ink" strokeWidth={0.03 * s}>
          {pane(-t / 2, 0, 1)}
          {pane(0, 0, 1)}
          {pane(t / 2, 0, 1)}
        </g>
      );
    case "sliding":
      return (
        <g className="stroke-ink" strokeWidth={0.04 * s}>
          {pane(-t / 4, 0, 0.55)}
          {pane(t / 4, 0.45, 1)}
        </g>
      );
    case "passage":
      return null;
    case "door":
    case "entrance": {
      if (!swing) return null;
      const { hinge, leaf, clockwise } = swing;
      const free = hinge.x === x1 && hinge.z === z1 ? { x: x2, z: z2 } : { x: x1, z: z1 };
      return (
        <g fill="none">
          <line
            x1={hinge.x}
            y1={hinge.z}
            x2={leaf.x}
            y2={leaf.z}
            strokeWidth={0.05 * s}
            className="stroke-ink"
          />
          <path
            d={`M ${leaf.x} ${leaf.z} A ${length} ${length} 0 0 ${clockwise ? 1 : 0} ${free.x} ${free.z}`}
            strokeWidth={0.025 * s}
            className="stroke-ink-muted"
          />
        </g>
      );
    }
  }
}

/** Splits a name in two lines at its last space that fits, or gives up. */
function labelLines(name: string, width: number, size: number): string[] | null {
  const fits = (text: string) => text.length * size * ADVANCE <= width;
  if (fits(name)) return [name];
  const words = name.split(" ");
  for (let i = words.length - 1; i > 0; i--) {
    const [first, second] = [words.slice(0, i).join(" "), words.slice(i).join(" ")];
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

type RoomLabelProps = {
  room: RoomGeometry;
  s: number;
  footprint: Rect;
  /** Phones: the name alone, larger, so it stays legible on a narrow plan. */
  compact?: boolean;
};

function RoomLabel({ room, s, footprint, compact = false }: RoomLabelProps) {
  const size = (compact ? 0.5 : 0.34) * s;
  const areaSize = 0.28 * s;
  // A stair says what it is with its treads.
  if (room.kind === "stair") return null;
  const box = labelArea(room);
  const lines = labelLines(room.name, box.w - 0.2 * s, size);
  const area = compact ? null : formatArea(room.area);
  const areaFits = !area || area.length * areaSize * ADVANCE <= box.w - 0.2 * s;
  const rows = (lines?.length ?? 0) + (area ? 1 : 0);
  if (!lines || !areaFits || rows * size * 1.3 > box.d - 0.2 * s) return null;

  // The garden's centre is the house: label it in the strip behind it instead.
  const cx = box.x + box.w / 2;
  const cz = room.kind === "garden" ? (box.z + footprint.z) / 2 : box.z + box.d / 2;
  const top = cz - (rows * size * 1.25) / 2 + size;
  return (
    <text textAnchor="middle" className="font-sans">
      {lines.map((line, i) => (
        <tspan
          key={i}
          x={cx}
          y={top + i * size * 1.25}
          fontSize={size}
          fontWeight={600}
          className="fill-ink"
        >
          {line}
        </tspan>
      ))}
      {area && (
        <tspan
          x={cx}
          y={top + lines.length * size * 1.25}
          fontSize={areaSize}
          className="fill-ink-muted"
        >
          {area}
        </tspan>
      )}
    </text>
  );
}

/**
 * A U-shaped stair seen from above: two flights side by side, split by a spine, with the landing
 * at the far end and the floor's own landing at the end it is entered from.
 */
function Stair({ room, entry, s }: { room: RoomGeometry; entry: Side | undefined; s: number }) {
  const alongZ = room.d >= room.w;
  // Position along the run (0 at the entry end) to plan coordinates.
  const run = alongZ ? room.d : room.w;
  const span = alongZ ? room.w : room.d;
  const fromStart = entry === "north" || entry === "west";
  const along = (p: number) => (alongZ ? room.z : room.x) + (fromStart ? p : run - p);
  const across = (q: number) => (alongZ ? room.x : room.z) + q;
  const line = (p1: number, q1: number, p2: number, q2: number, k: string) =>
    alongZ ? (
      <line key={k} x1={across(q1)} y1={along(p1)} x2={across(q2)} y2={along(p2)} />
    ) : (
      <line key={k} x1={along(p1)} y1={across(q1)} x2={along(p2)} y2={across(q2)} />
    );

  const arrival = 0.9;
  const landing = span / 2;
  const flight = run - arrival - landing;
  const count = Math.max(2, Math.round(flight / 0.27));
  return (
    <g className="stroke-ink-muted" strokeWidth={0.02 * s}>
      {line(arrival, 0, arrival, span, "start")}
      {line(arrival + flight, 0, arrival + flight, span, "landing")}
      {line(arrival, span / 2, arrival + flight, span / 2, "spine")}
      {Array.from({ length: count - 1 }, (_, i) => {
        const p = arrival + (flight / count) * (i + 1);
        return line(p, 0, p, span, `tread-${i}`);
      })}
    </g>
  );
}

function NorthArrow({ x, z, s }: { x: number; z: number; s: number }) {
  const r = 0.35 * s;
  return (
    <g className="fill-ink">
      <path
        d={`M ${x} ${z - r} L ${x + r * 0.55} ${z + r} L ${x} ${z + r * 0.55} L ${x - r * 0.55} ${z + r} Z`}
      />
      <text
        x={x}
        y={z - r - 0.15 * s}
        textAnchor="middle"
        fontSize={0.3 * s}
        fontWeight={700}
        className="font-sans"
      >
        N
      </text>
    </g>
  );
}

function ScaleBar({ x, z, s }: { x: number; z: number; s: number }) {
  // 2 m on a storey, 5 m on the plot.
  const metres = s > 1.4 ? 5 : 2;
  return (
    <g>
      <line x1={x} y1={z} x2={x + metres} y2={z} strokeWidth={0.06 * s} className="stroke-ink" />
      {[0, metres].map((m) => (
        <line
          key={m}
          x1={x + m}
          y1={z - 0.12 * s}
          x2={x + m}
          y2={z + 0.12 * s}
          strokeWidth={0.04 * s}
          className="stroke-ink"
        />
      ))}
      <text
        x={x + metres + 0.2 * s}
        y={z + 0.1 * s}
        fontSize={0.28 * s}
        className="fill-ink-muted font-sans"
      >
        {metres} m
      </text>
    </g>
  );
}

/**
 * The neighbour's half of a semi-detached pair, beyond the party wall: a hatched band in the margin
 * on that side of the frame, so the blind wall reads as shared.
 */
function Neighbour({ frame, side, s, id }: { frame: Rect; side: Side; s: number; id: string }) {
  const depth = 0.8 * s;
  const band: Rect = {
    north: { x: frame.x, z: frame.z - depth, w: frame.w, d: depth },
    south: { x: frame.x, z: frame.z + frame.d, w: frame.w, d: depth },
    west: { x: frame.x - depth, z: frame.z, w: depth, d: frame.d },
    east: { x: frame.x + frame.w, z: frame.z, w: depth, d: frame.d },
  }[side];
  const [cx, cz] = [band.x + band.w / 2, band.z + band.d / 2];
  const vertical = side === "east" || side === "west";
  const step = 0.3 * s;
  return (
    <g>
      <defs>
        <pattern
          id={id}
          width={step}
          height={step}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line x1={0} y1={0} x2={0} y2={step} strokeWidth={0.03 * s} className="stroke-line" />
        </pattern>
      </defs>
      <rect x={band.x} y={band.z} width={band.w} height={band.d} fill={`url(#${id})`} />
      <text
        x={cx}
        y={cz}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={0.28 * s}
        transform={vertical ? `rotate(${side === "east" ? 90 : -90} ${cx} ${cz})` : undefined}
        className="fill-ink-muted font-sans"
      >
        Vivienda vecina
      </text>
    </g>
  );
}

/** One floor's plan: rooms, walls with their openings, labels, the north and a scale. */
export function FloorPlanDrawing({ floor, footprint, partyWall, pointed }: FloorPlanDrawingProps) {
  const { geometry, frame } = floor;
  const s = Math.max(frame.w, frame.d) / 12;
  const m = MARGIN * s;
  const viewBox = [frame.x - m, frame.z - m, frame.w + 2 * m, frame.d + 2 * m].join(" ");
  const gapEnds = new Set(
    geometry.openings.flatMap(({ x1, z1, x2, z2 }) => [key(x1, z1), key(x2, z2)]),
  );
  const titleId = `plano-${floor.id}-dibujo`;

  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface-raised">
      <svg
        role="img"
        aria-labelledby={titleId}
        viewBox={viewBox}
        className="block h-auto max-h-[70svh] w-full"
        strokeLinecap="butt"
      >
        <title id={titleId}>{`Plano de ${floor.name.toLowerCase()}`}</title>

        {partyWall && <Neighbour frame={frame} side={partyWall} s={s} id={`vecina-${floor.id}`} />}

        {geometry.rooms.map((room) => (
          <rect
            key={room.id}
            x={room.x}
            y={room.z}
            width={room.w}
            height={room.d}
            className={cn(
              "transition-[fill] duration-(--duration-base) motion-reduce:transition-none",
              pointed === room.id ? "fill-terracota-soft" : (FILL[room.kind] ?? "fill-transparent"),
              // Outlined on the plot, where nothing else draws their edges.
              floor.kind === "plot" && room.kind !== "garden" && "stroke-ink-muted",
            )}
            strokeWidth={0.03 * s}
          />
        ))}

        {floor.kind === "plot" && (
          // The house on its plot: its footprint, solid, under the ground floor's walls.
          <rect
            x={footprint.x}
            y={footprint.z}
            width={footprint.w}
            height={footprint.d}
            className="fill-surface-raised stroke-ink"
            strokeWidth={THICKNESS.exterior * s}
          />
        )}

        {geometry.rooms.map((room) =>
          room.wardrobe ? (
            <g key={room.id} className="fill-none stroke-ink-muted" strokeWidth={0.025 * s}>
              <rect
                x={room.wardrobe.x}
                y={room.wardrobe.z}
                width={room.wardrobe.w}
                height={room.wardrobe.d}
              />
              <line
                x1={room.wardrobe.x}
                y1={room.wardrobe.z}
                x2={room.wardrobe.x + room.wardrobe.w}
                y2={room.wardrobe.z + room.wardrobe.d}
              />
            </g>
          ) : null,
        )}
        {geometry.rooms
          .filter(({ kind }) => kind === "stair")
          .map((room) => (
            <Stair key={room.id} room={room} entry={floor.stairEntry} s={s} />
          ))}

        {geometry.walls.map((wall, i) => (
          <Wall key={i} wall={wall} s={s} gapEnds={gapEnds} />
        ))}
        {geometry.openings.map((opening, i) => (
          <Opening key={i} opening={opening} s={s} />
        ))}

        {floor.kind === "plot" && (
          <text
            x={footprint.x + footprint.w / 2}
            y={footprint.z + footprint.d / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={0.34 * s}
            fontWeight={600}
            className="fill-ink font-sans"
          >
            Casa
          </text>
        )}
        <g className="hidden md:inline">
          {geometry.rooms.map((room) => (
            <RoomLabel key={room.id} room={room} s={s} footprint={footprint} />
          ))}
        </g>
        <g className="md:hidden">
          {geometry.rooms.map((room) => (
            <RoomLabel key={room.id} room={room} s={s} footprint={footprint} compact />
          ))}
        </g>

        <NorthArrow x={frame.x + frame.w + m / 2} z={frame.z - m / 2 + 0.25 * s} s={s} />
        <ScaleBar x={frame.x} z={frame.z + frame.d + m / 2} s={s} />
        <text
          x={frame.x + frame.w}
          y={frame.z + frame.d + m / 2 + 0.1 * s}
          textAnchor="end"
          fontSize={0.28 * s}
          className="fill-ink-muted font-sans"
        >
          Mar
        </text>
      </svg>
    </div>
  );
}
