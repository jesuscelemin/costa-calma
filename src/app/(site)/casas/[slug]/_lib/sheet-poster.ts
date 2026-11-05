import type { HousePlan, Rect } from "@/features/houses/schema";

import { SHEET_CUT, sheetFrame } from "./model-choreography";
import { floorModel, type Box } from "./model-geometry";
import { modelPalettes } from "./model-palette";
import { WEIGHTS, planSheet, type SheetMark, type SheetPoint } from "./plan-sheet";
import { POSTER_MARGIN, type PosterVersion } from "./poster-versions";
import { builtFloors, entranceOf } from "./tour";

// The sheet as the scene first draws it, as an SVG file, for the page to show while the 3D loads
// (and under it until it has drawn): the same marks and the ground floor's walls cut at the
// sheet's height, framed as the camera frames them, with the way in at the top. A file of its own,
// cached, rather than in the page, which would carry it twice, in its HTML and in its payload.

type Ink = { ink: string; paper: string };

const ALIGN = { left: "start", center: "middle", right: "end" } as const;
const n = (value: number) => String(Math.round(value * 1000) / 1000);
const at = ({ u, v }: SheetPoint) => `${n(u)} ${n(v)}`;
const escape = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** An element's attributes, leaving out those it does without. */
function attributes(values: Record<string, string | number | undefined>) {
  return Object.entries(values)
    .filter(([, value]) => value !== undefined)
    .map(([name, value]) => ` ${name}="${escape(String(value))}"`)
    .join("");
}

const fillOf = (fill: "paper" | "ink" | undefined, { ink, paper }: Ink) =>
  fill === "ink" ? ink : fill === "paper" ? paper : undefined;
const dashOf = (dash?: readonly number[]) => (dash?.length ? dash.map(n).join(" ") : undefined);

/** A mark as the canvas draws it. */
function mark(one: SheetMark, colours: Ink): string {
  switch (one.kind) {
    case "line":
      return `<path${attributes({
        d: `M${at(one.from)}L${at(one.to)}`,
        "stroke-width": WEIGHTS[one.weight],
        "stroke-dasharray": dashOf(one.dash),
      })}/>`;
    case "shape":
      if (one.ghost) return "";
      return `<path${attributes({
        d: `M${one.points.map(at).join("L")}${one.closed ? "Z" : ""}`,
        fill: fillOf(one.fill, colours),
        "stroke-width": WEIGHTS[one.weight],
        "stroke-dasharray": dashOf(one.dash),
      })}/>`;
    case "circle":
      return `<circle${attributes({
        cx: n(one.centre.u),
        cy: n(one.centre.v),
        r: n(one.radius),
        fill: fillOf(one.fill, colours),
        "stroke-width": WEIGHTS[one.weight],
        "stroke-dasharray": dashOf(one.dash),
      })}/>`;
    case "arc": {
      // The short way round, from one angle to the other.
      let delta = one.to - one.from;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      const point = (angle: number) =>
        at({
          u: one.centre.u + one.radius * Math.cos(angle),
          v: one.centre.v + one.radius * Math.sin(angle),
        });
      const r = n(one.radius);
      return `<path${attributes({
        d: `M${point(one.from)}A${r} ${r} 0 0 ${delta > 0 ? 1 : 0} ${point(one.from + delta)}`,
        "stroke-width": WEIGHTS[one.weight],
      })}/>`;
    }
    case "text":
      return `<text${attributes({
        transform: `translate(${at(one.at)})${one.upright ? " rotate(-90)" : ""}`,
        "font-size": n(one.size),
        "font-weight": one.weight,
        "letter-spacing": one.tracking ? n(one.tracking * one.size) : undefined,
        "text-anchor": ALIGN[one.align],
        "dominant-baseline": "middle",
        fill: colours.ink,
        stroke: "none",
      })}>${escape(one.text)}</text>`;
  }
}

/**
 * The ground floor's walls as the scene shows them from above, cut at the sheet's height: what the
 * cut goes through in solid ink, and what stands lower, the stair and the sills, in paper lined in
 * ink.
 */
function cutWalls(plan: HousePlan, colours: Ink) {
  const [ground, next] = builtFloors(plan);
  if (!ground) return "";
  const model = floorModel(plan, ground, { next });
  const standing = [...model.walls, ...model.frames, ...model.joinery, ...model.glass];
  const cut = standing.filter(({ y, h }) => y < SHEET_CUT && y + h > SHEET_CUT);
  const lower = [...model.stair, ...standing.filter(({ y, h }) => y + h <= SHEET_CUT)];
  // On the sheet, a box's corner at (x, z) is at (−x − w, −z − d).
  const rect = ({ x, z, w, d }: Box, rest: Record<string, string | number>) =>
    `<rect${attributes({ x: n(-x - w), y: n(-z - d), width: n(w), height: n(d), ...rest })}/>`;
  return [
    ...lower.map((box) => rect(box, { fill: colours.paper, "stroke-width": WEIGHTS.hair })),
    ...cut.map((box) => rect(box, { fill: colours.ink, stroke: "none" })),
  ].join("");
}

/**
 * A world rectangle on the sheet, turned so that the way in is up, with the poster's margin all
 * round: as a viewBox. What lies past the frame shows too, as on the canvas.
 */
function viewBox(rect: Rect, turn: number) {
  // The sheet's (u, v) is the world's (−x, −z), and the poster turns it about its origin.
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  const corners = [
    [rect.x, rect.z],
    [rect.x + rect.w, rect.z],
    [rect.x, rect.z + rect.d],
    [rect.x + rect.w, rect.z + rect.d],
  ].map(([x, z]) => [-x! * cos + z! * sin, -x! * sin - z! * cos] as const);
  const xs = corners.map(([x]) => x);
  const ys = corners.map(([, y]) => y);
  const [x0, y0] = [Math.min(...xs), Math.min(...ys)];
  const [w, h] = [Math.max(...xs) - x0, Math.max(...ys) - y0];
  const grow = 1 + 2 * POSTER_MARGIN;
  return { x: x0 - w * POSTER_MARGIN, y: y0 - h * POSTER_MARGIN, w: w * grow, h: h * grow };
}

/** The sheet's SVG, for a theme and a screen held upright or across; none without a storey. */
export function sheetPosterSvg(plan: HousePlan, name: string, version: PosterVersion) {
  const ground = builtFloors(plan)[0];
  if (!ground) return null;
  const palette = modelPalettes[version.startsWith("noche") ? "dark" : "light"];
  const colours = { ink: palette.ink, paper: palette.background };
  const inward = entranceOf(plan)?.inward ?? { x: 0, z: 1 };
  // The sheet's up is its −v, the world's +z: turned for the way in, (−x, −z) on the sheet, to be up.
  const turn = -Math.atan2(-inward.x, inward.z);
  const degrees = Math.round((turn * 180) / Math.PI);
  const box = viewBox(sheetFrame(plan, version.endsWith("vertical")), turn);
  const marks = planSheet(plan, ground, name)
    .marks.map((one) => mark(one, colours))
    .join("");
  return (
    `<svg${attributes({
      xmlns: "http://www.w3.org/2000/svg",
      viewBox: [box.x, box.y, box.w, box.h].map(n).join(" "),
      // Its size in centimetres: what an <img> takes its shape from.
      width: Math.round(box.w * 100),
      height: Math.round(box.h * 100),
      "font-family": "Manrope, system-ui, sans-serif",
    })}>` +
    `<g${attributes({
      transform: degrees ? `rotate(${degrees})` : undefined,
      fill: "none",
      stroke: colours.ink,
    })}>${marks}${cutWalls(plan, colours)}</g></svg>`
  );
}
