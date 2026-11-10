import * as THREE from "three";

import { WEIGHTS, type SheetDrawing, type SheetMark } from "../../_lib/plan-sheet";

import { sweepDrawingMaterial, type SweepUniforms } from "./model-materials";

// The sheet drawn on a canvas, ink on paper, and laid on its floor as a quad in the world, for
// the model's walls to rise from (ADR 0010). The ground floor's has its paper, with a faint grain
// and edges that fade into the page; the floors above draw only their ink.

export type DrawingInk = {
  /** The paper: `surface`. None for a floor above, which draws only its ink. */
  paper: string | null;
  /** What the ink fills with where it hides what is under it: the paper's colour. */
  fill: string;
  ink: string;
  font: string;
};

/** How far the paper's edges fade into the page, in metres. */
const EDGE_FADE = 2.6;

function strokeMark(
  context: CanvasRenderingContext2D,
  mark: SheetMark,
  ppm: number,
  ink: DrawingInk,
) {
  const lineWidth = (weight: keyof typeof WEIGHTS) => Math.max(1, WEIGHTS[weight] * ppm);
  const dash = (pattern?: readonly number[]) =>
    context.setLineDash((pattern ?? []).map((m) => m * ppm));
  switch (mark.kind) {
    case "line":
      context.beginPath();
      context.moveTo(mark.from.u, mark.from.v);
      context.lineTo(mark.to.u, mark.to.v);
      context.lineWidth = lineWidth(mark.weight) / ppm;
      dash(mark.dash?.map((m) => m / ppm));
      context.stroke();
      return;
    case "shape": {
      if (mark.ghost) return;
      context.beginPath();
      mark.points.forEach(({ u, v }, i) => (i === 0 ? context.moveTo(u, v) : context.lineTo(u, v)));
      if (mark.closed) context.closePath();
      if (mark.fill) {
        context.fillStyle = mark.fill === "ink" ? ink.ink : ink.fill;
        context.fill();
      }
      context.lineWidth = lineWidth(mark.weight) / ppm;
      dash(mark.dash?.map((m) => m / ppm));
      context.stroke();
      return;
    }
    case "circle":
      context.beginPath();
      context.arc(mark.centre.u, mark.centre.v, mark.radius, 0, Math.PI * 2);
      if (mark.fill) {
        context.fillStyle = mark.fill === "ink" ? ink.ink : ink.fill;
        context.fill();
      }
      context.lineWidth = lineWidth(mark.weight) / ppm;
      dash(mark.dash?.map((m) => m / ppm));
      context.stroke();
      return;
    case "arc": {
      let delta = mark.to - mark.from;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      context.beginPath();
      context.arc(
        mark.centre.u,
        mark.centre.v,
        mark.radius,
        mark.from,
        mark.from + delta,
        delta < 0,
      );
      context.lineWidth = lineWidth(mark.weight) / ppm;
      dash([]);
      context.stroke();
      return;
    }
    case "text": {
      context.save();
      context.translate(mark.at.u, mark.at.v);
      if (mark.turn) context.rotate(mark.turn);
      if (mark.upright) context.rotate(-Math.PI / 2);
      // Text at the canvas's own scale, for the browser to hint it.
      context.scale(1 / ppm, 1 / ppm);
      context.font = `${mark.weight} ${mark.size * ppm}px ${ink.font}`;
      context.letterSpacing = `${(mark.tracking ?? 0) * mark.size * ppm}px`;
      context.textAlign = mark.align;
      context.textBaseline = "middle";
      context.fillStyle = ink.ink;
      context.fillText(mark.text, 0, 0);
      context.restore();
      return;
    }
  }
}

/** A faint grain over the paper: specks of ink and of light, scattered evenly. */
function grain(context: CanvasRenderingContext2D, width: number, height: number, ink: string) {
  const specks = Math.round((width * height) / 90);
  context.save();
  context.fillStyle = ink;
  for (let i = 0; i < specks; i++) {
    // A fixed scatter, the same on every load: a cheap hash of the index.
    const a = Math.sin(i * 12.9898) * 43758.5453;
    const b = Math.sin(i * 78.233) * 12543.123;
    context.globalAlpha = 0.018 + (Math.abs(a) % 1) * 0.03;
    context.fillRect((Math.abs(a) % 1) * width, (Math.abs(b) % 1) * height, 1, 1);
  }
  context.restore();
}

/** Fades the paper out over its edges, into the page behind it. */
function fadeEdges(context: CanvasRenderingContext2D, width: number, height: number, by: number) {
  context.save();
  context.globalCompositeOperation = "destination-in";
  const across = context.createLinearGradient(0, 0, width, 0);
  across.addColorStop(0, "rgba(0,0,0,0)");
  across.addColorStop(by / width, "rgba(0,0,0,1)");
  across.addColorStop(1 - by / width, "rgba(0,0,0,1)");
  across.addColorStop(1, "rgba(0,0,0,0)");
  context.fillStyle = across;
  context.fillRect(0, 0, width, height);
  const down = context.createLinearGradient(0, 0, 0, height);
  down.addColorStop(0, "rgba(0,0,0,0)");
  down.addColorStop(by / height, "rgba(0,0,0,1)");
  down.addColorStop(1 - by / height, "rgba(0,0,0,1)");
  down.addColorStop(1, "rgba(0,0,0,0)");
  context.fillStyle = down;
  context.fillRect(0, 0, width, height);
  context.restore();
}

/** The drawing on a canvas, at so many pixels a metre, no larger than the GPU takes. */
export function drawSheet(drawing: SheetDrawing, ink: DrawingInk, ppm: number, maxSize: number) {
  const { u0, v0, u1, v1 } = drawing.bounds;
  const scale = Math.min(ppm, maxSize / (u1 - u0), maxSize / (v1 - v0));
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil((u1 - u0) * scale);
  canvas.height = Math.ceil((v1 - v0) * scale);
  const context = canvas.getContext("2d");
  if (!context) return null;
  if (ink.paper) {
    context.fillStyle = ink.paper;
    context.fillRect(0, 0, canvas.width, canvas.height);
    grain(context, canvas.width, canvas.height, ink.ink);
  }
  context.save();
  context.scale(scale, scale);
  context.translate(-u0, -v0);
  context.strokeStyle = ink.ink;
  context.lineCap = "butt";
  context.lineJoin = "miter";
  for (const mark of drawing.marks) strokeMark(context, mark, scale, ink);
  context.restore();
  if (ink.paper) fadeEdges(context, canvas.width, canvas.height, EDGE_FADE * scale);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  return texture;
}

/** The quad the drawing lies on, at a height, in the world: the sheet's metres turned back. */
export function sheetQuad(drawing: SheetDrawing, y: number) {
  const { u0, v0, u1, v1 } = drawing.bounds;
  // Sheet (u, v) is world (−u, −v); the canvas's top is the texture's v = 1.
  const corners = [
    [u0, v0, 0, 1],
    [u1, v0, 1, 1],
    [u1, v1, 1, 0],
    [u0, v1, 0, 0],
  ] as const;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      corners.flatMap(([u, v]) => [-u, y, -v]),
      3,
    ),
  );
  geometry.setAttribute(
    "uv",
    new THREE.Float32BufferAttribute(
      corners.flatMap(([, , s, t]) => [s, t]),
      2,
    ),
  );
  geometry.setAttribute(
    "normal",
    new THREE.Float32BufferAttribute(
      corners.flatMap(() => [0, 1, 0]),
      3,
    ),
  );
  // Facing up: wound anticlockwise as seen from above.
  geometry.setIndex([0, 2, 1, 0, 3, 2]);
  return geometry;
}

/** The drawing's material: its canvas, wiped room by room as each turns into colour, and cut. */
export function drawingMaterial(
  texture: THREE.Texture,
  uniforms: SweepUniforms,
  clipping: THREE.Plane[],
) {
  return sweepDrawingMaterial(texture, uniforms, clipping);
}
