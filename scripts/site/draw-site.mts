// Draws Costa Calma's site plan seen from above, as an SVG, for checking the layout by eye:
// the terraces, the road, the beach and the sea, each plot with its plan's plot and ground floor
// rooms, the zones and the unit numbers.
//
// Run: node scripts/site/draw-site.mts [out.svg]
import { writeFileSync } from "node:fs";

import type { HousePlan, Room } from "../../src/features/houses/schema.ts";
import { sitePlan, sitePlans } from "../../src/features/site/data.ts";
import type { SitePoint, Terrace } from "../../src/features/site/schema.ts";
import { toSite } from "../../src/features/site/site-plan.ts";

const SCALE = 5; // px per metre
const MARGIN = 40;

const all = sitePlan.terraces.flatMap(({ outline }) => outline);
const minX = Math.min(...all.map(({ x }) => x)) - 10;
const maxX = Math.max(...all.map(({ x }) => x)) + 10;
const minZ = Math.min(...all.map(({ z }) => z)) - 10;
const maxZ = Math.max(...all.map(({ z }) => z)) + 30;
const width = (maxX - minX) * SCALE + MARGIN * 2;
const height = (maxZ - minZ) * SCALE + MARGIN * 2 + 60;

const px = ({ x, z }: SitePoint) =>
  `${((x - minX) * SCALE + MARGIN).toFixed(1)},${((z - minZ) * SCALE + MARGIN).toFixed(1)}`;
const polygon = (points: SitePoint[], style: string) =>
  `<polygon points="${points.map(px).join(" ")}" ${style}/>`;
const polyline = (points: SitePoint[], style: string) =>
  `<polyline points="${points.map(px).join(" ")}" fill="none" ${style}/>`;

const terraceFill = ({ kind, planting }: Terrace) =>
  ({
    beach: "#F1E4C8",
    promenade: "#C9A77C",
    road: "#E4E2DD",
    vine: "#C9D3A6",
    olive: "#B7C4A0",
    pine: "#9DB08A",
    garden: "#D5E0C6",
    scrub: "#CBCFB5",
  })[kind === "row" || kind === "bancal" ? (planting ?? "scrub") : kind];

const roomFill = (kind: Room["kind"]) =>
  ({
    pool: "#7FB7C4",
    water: "#9CCBD3",
    garden: "#B9CDA0",
    patio: "#C8D6B2",
    deck: "#C9A77C",
    garage: "#CFCBC2",
    planter: "#A8C08A",
    terrace: "#E9E3D6",
    lounge: "#E9E3D6",
  })[kind as string] ?? "#FFFFFF";

const rect = (room: Pick<Room, "x" | "z" | "w" | "d">): SitePoint[] => [
  { x: room.x, z: room.z },
  { x: room.x + room.w, z: room.z },
  { x: room.x + room.w, z: room.z + room.d },
  { x: room.x, z: room.z + room.d },
];

const parts: string[] = [];

// The sea, from the shoreline to the bottom of the drawing.
const shore = sitePlan.shoreline;
parts.push(
  polygon(
    [...shore, { x: shore.at(-1)!.x, z: maxZ + 20 }, { x: shore[0]!.x, z: maxZ + 20 }],
    'fill="#9DB6BE"',
  ),
);

for (const terrace of sitePlan.terraces) {
  parts.push(
    polygon(terrace.outline, `fill="${terraceFill(terrace)}" stroke="#8C8579" stroke-width="1.5"`),
  );
}

for (const { centre, width: roadWidth } of sitePlan.roads) {
  parts.push(
    polyline(
      centre,
      `stroke="#B8B4AC" stroke-width="${roadWidth * SCALE}" stroke-linejoin="round"`,
    ),
  );
}
for (const { centre } of sitePlan.roads) {
  parts.push(polyline(centre, 'stroke="#FFFFFF" stroke-width="1" stroke-dasharray="8 8"'));
}

for (const plot of sitePlan.plots) {
  const plan = sitePlans[plot.houseType] as HousePlan;
  const place = (points: SitePoint[]) => points.map((point) => toSite(plot, plan, point));
  parts.push(polygon(place(rect(plan.plot)), 'fill="#EEF0E6" stroke="#1C1C1C" stroke-width="1"'));
  const [plotFloor, ground] = plan.floors;
  for (const room of plotFloor?.rooms ?? []) {
    if (room.kind === "garden") continue;
    parts.push(
      polygon(
        place(rect(room)),
        `fill="${roomFill(room.kind)}" stroke="#626467" stroke-width="0.5"`,
      ),
    );
  }
  for (const room of ground?.rooms ?? []) {
    if (room.kind === "void") continue;
    parts.push(
      polygon(
        place(rect(room)),
        `fill="${roomFill(room.kind)}" stroke="#1C1C1C" stroke-width="0.6"`,
      ),
    );
  }
  const label = px({ x: plot.x, z: plot.z }).split(",");
  parts.push(
    `<circle cx="${label[0]}" cy="${label[1]}" r="13" fill="#1C1C1C"/>`,
    `<text x="${label[0]}" y="${Number(label[1]) + 5}" text-anchor="middle" font-size="14" font-weight="600" fill="#FFFFFF">${plot.unit}</text>`,
  );
}

const frontRoad = sitePlan.roads.find(({ id }) => id === "front") ?? sitePlan.roads[0]!;
const roadZ = frontRoad.centre[Math.floor(frontRoad.centre.length / 2)]!.z;
for (const zone of sitePlan.zones) {
  parts.push(
    polygon(zone.outline, 'fill="none" stroke="#3F5F69" stroke-width="2" stroke-dasharray="10 6"'),
  );
  // The name goes on the zone's side away from the road.
  const centreZ = zone.outline.reduce((sum, p) => sum + p.z, 0) / zone.outline.length;
  const seaward = centreZ > roadZ;
  const edge = zone.outline.reduce((best, point) =>
    seaward ? (point.z > best.z ? point : best) : point.z < best.z ? point : best,
  );
  const [x, y] = px(edge).split(",");
  parts.push(
    `<text x="${x}" y="${Number(y) + (seaward ? 24 : -10)}" text-anchor="middle" font-size="18" fill="#3F5F69">${zone.name}</text>`,
  );
}

// Each terrace's level, at its west end.
for (const { level, outline } of sitePlan.terraces) {
  const inner = outline[0]!;
  const outer = outline.at(-1)!;
  const [x, y] = px({ x: (inner.x + outer.x) / 2, z: (inner.z + outer.z) / 2 }).split(",");
  parts.push(
    `<text x="${Number(x) + 30}" y="${Number(y) + 5}" font-size="13" fill="#3D3F42">+${String(level).replace(".", ",")} m</text>`,
  );
}

// Scale bar and north.
const bar = `M ${MARGIN} ${height - 30} h ${50 * SCALE}`;
parts.push(
  `<path d="${bar}" stroke="#1C1C1C" stroke-width="3"/>`,
  `<text x="${MARGIN}" y="${height - 40}" font-size="13" fill="#1C1C1C">50 m</text>`,
  `<text x="${width - MARGIN}" y="${MARGIN + 10}" text-anchor="end" font-size="16" fill="#1C1C1C">N ↑</text>`,
  `<text x="${width / 2}" y="${height - 24}" text-anchor="middle" font-size="16" fill="#1C1C1C">Costa Calma · plano de la urbanización · mar al sur</text>`,
);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width.toFixed(0)}" height="${height.toFixed(0)}" viewBox="0 0 ${width.toFixed(0)} ${height.toFixed(0)}" font-family="Helvetica, Arial, sans-serif"><rect width="100%" height="100%" fill="#FFFFFF"/>${parts.join("")}</svg>`;

const out = process.argv[2] ?? "site-plan.svg";
writeFileSync(out, svg);
console.log("wrote", out);
