// Builds the house models' furniture into public/media/furniture/ (ADR 0007, ADR 0011, ADR 0012):
// glTF pieces kept with their own PBR textures, from IKEA's site (downloaded into assets-src/ikea/,
// outside git), from Poly Haven, or from files left by hand in assets-src/. Each is turned to face south, scaled to metres,
// simplified, its textures cut down to WebP, and compressed with meshopt: one .glb at 1024 px for a
// desktop and one at 512 px for a phone. Writes the manifest the plan's furniture is checked
// against, and the credits in docs/credits.md.
//
//   npm run media:furniture                downloads what is missing, then rebuilds every piece
//   npm run media:furniture -- --offline   only from what assets-src/ already has
//
// A piece from elsewhere (Sketchfab, BlendKit, Poliigon…) goes in assets-src/<origin>/<piece>/ as
// glTF 2.0 (.glb, or .gltf with its .bin and textures): export FBX, OBJ or .blend to glTF from
// Blender first. Then add it to PIECES below with its credit and licence.
//
// Each piece faces south (+z) once built, stands on y = 0 and is centred on its footprint.

import { existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";

import { type Document, Logger, NodeIO, getBounds } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import {
  center,
  clearNodeTransform,
  cloneDocument,
  compactPrimitive,
  dedup,
  flatten,
  join as joinPrimitives,
  meshopt,
  prune,
  simplify,
  textureCompress,
  transformMesh,
  weld,
} from "@gltf-transform/functions";
import draco3d from "draco3dgltf";
import { MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";
import { format } from "prettier";
import sharp from "sharp";

import {
  type FurnitureManifest,
  furnitureManifestSchema,
} from "../../src/features/houses/furniture-manifest.ts";

/** Where a piece comes from, and what the credits say of it. */
type Source =
  | { polyhaven: string }
  | {
      /** Its item number on ikea.com, and its name there, for the credits (ADR 0012). */
      ikea: string;
      name: string;
    }
  | {
      /** Its glTF, under assets-src/. */
      local: string;
      name: string;
      authors: string[];
      url: string;
      licence: string;
    };

type PieceSpec = {
  /** Our id, as the plan names it. */
  id: string;
  source: Source;
  /** What the piece is, in Spanish, for the credits. */
  label: string;
  /** Quarter turns anticlockwise, seen from above, for its front to face south. */
  turn?: 0 | 1 | 2 | 3;
  /** How much to scale it by, for a source not in metres: 0.01 for centimetres. */
  scale?: number;
  /** A colour to multiply a material's by, for it to sit in the brand's tones. */
  tint?: Record<string, string>;
  /** At most this many triangles. */
  triangles: number;
  /** Drawn on the plan as a circle, not a rectangle. */
  round?: boolean;
  /**
   * How far the simplified piece may stray from the original, as a share of its size; by default,
   * more for the woven pieces (WOVEN).
   */
  error?: number;
  /**
   * For a pendant: how tall it may stand, in metres; its cord, above, is drawn in to this height,
   * so it hangs from the ceiling with its shade where a lamp over a table hangs.
   */
  top?: number;
  /** A bed frame that comes bare, its slats showing: made up with a mattress and its bedding. */
  bedding?: boolean;
};

const ikea = (
  id: string,
  item: string,
  name: string,
  label: string,
  triangles: number,
  extra: Partial<PieceSpec> = {},
): PieceSpec => ({ id, source: { ikea: item, name }, label, triangles, ...extra });

// IKEA's own models, for a demonstration only (ADR 0012): light linen, oak, walnut, rattan and
// bouclé, in the brand's tones. Each faces south as it comes.
const PIECES: PieceSpec[] = [
  // Sitting
  ikea("sofa", "19399033", "VIMLE sofá 3 plazas", "Sofá de tres plazas", 8000),
  ikea("sofa-chaise", "09449689", "SÖDERHAMN sofá con chaiselongue", "Sofá con chaiselongue", 8000),
  ikea("linen-sofa", "79489634", "HYLTARP sofá 3 plazas", "Sofá de lino", 8000),
  ikea("boucle-chair", "20594750", "STOCKHOLM 2025 sillón", "Sillón de bouclé", 4000),
  ikea("rattan-armchair", "79578263", "STOCKHOLM 2025 sillón de ratán", "Sillón de ratán", 12000),
  ikea("oak-armchair", "60506898", "EKENÄSET sillón", "Butaca de roble", 5000),
  ikea("pouf", "60586140", "STOCKHOLM 2025 reposapiés", "Puf", 3000),
  ikea("dining-chair", "39388081", "BERGMUND silla", "Silla de comedor", 3000),
  ikea("bar-stool", "30554635", "GRÖNSTA taburete de bar", "Taburete alto", 3000),
  ikea("desk-chair", "20576553", "ROSENTORP silla giratoria", "Silla de escritorio", 5000),
  ikea("rattan-bench", "80512657", "TOLKNING banco", "Banco de ratán", 4000),
  ikea("oak-bench", "90586515", "STOCKHOLM 2025 banco", "Banco de roble", 4000),
  ikea("bath-bench", "60549416", "RÅGRUND banco", "Banco de bambú", 4000),
  // Tables
  ikea(
    "round-coffee-table",
    "20586552",
    "STOCKHOLM 2025 mesa de centro",
    "Mesa baja redonda",
    5000,
    {
      round: true,
    },
  ),
  ikea("coffee-table", "70239710", "STOCKHOLM mesa de centro", "Mesa baja de nogal", 5000),
  ikea("side-table", "80619880", "BORGEBY mesa auxiliar", "Mesa auxiliar", 3000, { round: true }),
  ikea("dining-table", "20293766", "MÖRBYLÅNGA mesa", "Mesa de comedor", 4000),
  ikea("desk", "60538205", "TONSTAD escritorio", "Escritorio", 4000),
  // Storage
  ikea("sideboard", "10586604", "STOCKHOLM 2025 aparador", "Aparador", 4000),
  ikea("rattan-cabinet", "40574096", "FRYKSÅS armario", "Armario de ratán", 4000),
  ikea("dresser", "50614624", "TONSTAD cómoda", "Cómoda", 2000),
  ikea("nightstand", "80489322", "TONSTAD mesilla", "Mesilla", 3000),
  ikea("walnut-nightstand", "80593597", "RÅDMANSÖ mesilla", "Mesilla de nogal", 3000),
  // Beds
  ikea("bed", "19564363", "TÄRNKULLEN cama tapizada", "Cama de matrimonio", 5000, {
    bedding: true,
  }),
  ikea("upholstered-bed", "60573251", "TUFJORD cama tapizada", "Cama tapizada", 5000, {
    bedding: true,
  }),
  ikea("single-bed", "70608066", "GULLABERG cama", "Cama individual", 5000, { bedding: true }),
  // Rugs
  ikea("rug", "50277393", "LOHALS alfombra", "Alfombra de yute", 600),
  ikea("cream-rug", "10605075", "ÄRENDE alfombra", "Alfombra de lana", 600),
  ikea("round-rug", "70426801", "STOENSE alfombra", "Alfombra redonda", 600, { round: true }),
  // Light
  ikea("floor-lamp", "50585914", "STOCKHOLM 2025 lámpara de pie", "Lámpara de pie", 4000, {
    round: true,
  }),
  ikea("rattan-pendant", "00594341", "NARRKOLV lámpara de techo", "Lámpara de ratán", 6000, {
    round: true,
    top: 1.3,
  }),
  ikea("table-lamp", "90585926", "STOCKHOLM 2025 lámpara de mesa", "Lámpara de mesa", 3000, {
    round: true,
  }),
  ikea("ceramic-lamp", "80501258", "BLIDVÄDER lámpara de mesa", "Lámpara de cerámica", 3000, {
    round: true,
  }),
  ikea("mirror", "30298396", "IKORNNES espejo de pie", "Espejo de pie", 2000),
  // Plants and pieces
  ikea("tree-plant", "30615276", "FEJKA planta artificial", "Árbol en maceta", 8000, {
    round: true,
  }),
  ikea("bamboo", "40610607", "FEJKA bambú artificial", "Bambú en maceta", 8000, { round: true }),
  ikea("palm", "00600894", "FEJKA palmera artificial", "Palmera en maceta", 8000, { round: true }),
  ikea("leafy-plant", "10600860", "FEJKA planta artificial", "Planta de hoja", 6000, {
    round: true,
  }),
  ikea("vase", "80607311", "PELARBJÖRK jarrón", "Jarrón", 1500, { round: true }),
  ikea("tall-vase", "10592365", "STILREN jarrón", "Jarrón alto", 1500, { round: true }),
  // Outside
  ikea("sun-lounger", "79494857", "SEGERÖN tumbona", "Tumbona", 8000),
  ikea("outdoor-sofa", "49495066", "HAVSTEN sofá 2 plazas", "Sofá de exterior", 8000),
  ikea("outdoor-armchair", "79578362", "NÄMMARÖ sillón", "Sillón de exterior", 6000),
  ikea("outdoor-lounge-chair", "29585713", "TVARÖ sillón", "Sillón de exterior de ratán", 8000),
  ikea("outdoor-coffee-table", "60594932", "NÄMMARÖ mesa de centro", "Mesa baja de exterior", 3000),
  ikea("outdoor-dining-table", "20510307", "NÄMMARÖ mesa", "Mesa de exterior", 3000),
  ikea("outdoor-chair", "99494842", "SEGERÖN silla", "Silla de exterior", 8000),
  ikea(
    "outdoor-side-table",
    "70510300",
    "NÄMMARÖ mesa auxiliar",
    "Mesa auxiliar de exterior",
    2000,
  ),
  ikea("parasol", "49576213", "SVALÖN sombrilla", "Sombrilla", 8000),
];

/**
 * The pieces whose rattan, leaves, cords or slats have more triangles than the eye reads: they may
 * stray further from the original as they are simplified.
 */
const WOVEN = new Set([
  "rattan-armchair",
  "rattan-pendant",
  "palm",
  "sun-lounger",
  "outdoor-lounge-chair",
  "outdoor-chair",
  "outdoor-armchair",
  "outdoor-sofa",
  "outdoor-coffee-table",
  "outdoor-dining-table",
  "parasol",
  "nightstand",
  "walnut-nightstand",
  "coffee-table",
  "bar-stool",
  "desk",
]);

/**
 * The pieces of many loose parts whose look is their shape, not their texture: simplified past
 * what keeps each part, as a voxel grid would, for the rest would smear their textures.
 */
const SLOPPY = new Set(["sun-lounger", "parasol", "outdoor-chair", "outdoor-lounge-chair", "palm"]);

const SOURCES = "assets-src";
const OUT = "public/media/furniture";
const CREDITS = "docs/credits.md";
const POLYHAVEN_RESOLUTION = "1k";
const USER_AGENT = "costa-calma-build";
/**
 * Each version's textures, in pixels a side: about 600 to a metre of the piece on a desktop, half
 * that on a phone, in powers of two. A vase does not need what a sofa does.
 */
const PIXELS_PER_METRE = 600;
const VERSIONS = { desktop: { max: 1024, share: 1 }, mobile: { max: 512, share: 0.5 } } as const;
const texturePixels = (largest: number, { max, share }: { max: number; share: number }) =>
  Math.min(max, Math.max(128, 2 ** Math.round(Math.log2(largest * PIXELS_PER_METRE * share))));
const WEBP_QUALITY = 82;

type PolyHavenFile = { url: string; size: number; md5: string };
type PolyHavenFiles = {
  gltf: Record<string, { gltf: PolyHavenFile & { include: Record<string, PolyHavenFile> } }>;
};
type PolyHavenInfo = { name: string; authors: Record<string, string> };

async function json<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return (await response.json()) as T;
}

/** A Poly Haven piece's glTF in assets-src/, downloaded if it is not there yet. */
async function fromPolyHaven(id: string, offline: boolean): Promise<string> {
  const dir = join(SOURCES, "polyhaven", id);
  const main = join(dir, `${id}.gltf`);
  if (existsSync(main)) return main;
  if (offline) throw new Error(`${main} is missing; run without --offline`);
  const files = await json<PolyHavenFiles>(`https://api.polyhaven.com/files/${id}`);
  const gltf = files.gltf[POLYHAVEN_RESOLUTION]?.gltf;
  if (!gltf) throw new Error(`${id} has no ${POLYHAVEN_RESOLUTION} glTF`);
  const downloads: [string, string][] = [
    [gltf.url, main],
    ...Object.entries(gltf.include).map(([path, file]): [string, string] => [
      file.url,
      join(dir, path),
    ]),
  ];
  for (const [url, path] of downloads) {
    mkdirSync(dirname(path), { recursive: true });
    const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!response.ok) throw new Error(`${url}: ${response.status}`);
    writeFileSync(path, Buffer.from(await response.arrayBuffer()));
  }
  return main;
}

const IKEA_MARKET = "es/es";
/** The id IKEA's own site sends to its model service. */
const IKEA_CLIENT = "4863e7d2-1428-4324-890b-ae5dede24fc6";

/** An IKEA piece's model in assets-src/, downloaded from ikea.com if it is not there yet. */
async function fromIkea(item: string, offline: boolean): Promise<string> {
  const path = join(SOURCES, "ikea", `${item}.glb`);
  if (existsSync(path)) return path;
  if (offline) throw new Error(`${path} is missing; run without --offline`);
  const headers = { "User-Agent": USER_AGENT, "X-Client-Id": IKEA_CLIENT };
  const { modelUrl } = await (async () => {
    const url = `https://web-api.ikea.com/${IKEA_MARKET}/rotera/data/model/${item}/`;
    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error(`${url}: ${response.status}`);
    return (await response.json()) as { modelUrl: string };
  })();
  const response = await fetch(modelUrl, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) throw new Error(`${modelUrl}: ${response.status}`);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, Buffer.from(await response.arrayBuffer()));
  return path;
}

/** Where a piece's original is, and its credit. */
async function original(spec: PieceSpec, offline: boolean) {
  const { source } = spec;
  if ("local" in source) {
    const path = join(SOURCES, source.local);
    if (!existsSync(path)) throw new Error(`${spec.id}: ${path} is missing`);
    return {
      path,
      credit: {
        name: source.name,
        authors: source.authors,
        url: source.url,
        licence: source.licence,
      },
    };
  }
  if ("ikea" in source) {
    return {
      path: await fromIkea(source.ikea, offline),
      credit: {
        name: source.name,
        authors: ["IKEA"],
        url: `https://www.ikea.com/${IKEA_MARKET}/search/?q=${source.ikea}`,
        licence: "© IKEA, demostración sin licencia (ADR 0012)",
      },
    };
  }
  const path = await fromPolyHaven(source.polyhaven, offline);
  const info = await json<PolyHavenInfo>(
    `https://api.polyhaven.com/info/${source.polyhaven}`,
  ).catch(() => null);
  return {
    path,
    credit: {
      name: info?.name ?? source.polyhaven,
      authors: info ? Object.keys(info.authors) : ["Poly Haven"],
      url: `https://polyhaven.com/a/${source.polyhaven}`,
      licence: "CC0 1.0",
    },
  };
}

/** Bakes every node's transform into its mesh, so the piece is in the scene's own metres. */
function bake(document: Document) {
  for (const node of document.getRoot().listNodes()) clearNodeTransform(node);
}

/** Its geometry and materials once, in metres, facing south, simplified; textures as they come. */
async function prepare(spec: PieceSpec, path: string, io: NodeIO) {
  const document = await io.read(path);
  document.setLogger(new Logger(Logger.Verbosity.WARN));
  const root = document.getRoot();

  // Only what the scene reads: its points, its normals and where its textures fall.
  for (const mesh of root.listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      for (const semantic of primitive.listSemantics()) {
        if (!["POSITION", "NORMAL", "TEXCOORD_0"].includes(semantic)) {
          primitive.setAttribute(semantic, null);
        }
      }
    }
  }

  for (const [name, colour] of Object.entries(spec.tint ?? {})) {
    const material = root.listMaterials().find((m) => m.getName() === name);
    if (!material) throw new Error(`${spec.id}: no material "${name}" to tint`);
    const [r, g, b] = [1, 3, 5].map((at) => parseInt(colour.slice(at, at + 2), 16) / 255) as [
      number,
      number,
      number,
    ];
    const [fr, fg, fb, fa] = material.getBaseColorFactor();
    material.setBaseColorFactor([fr * r, fg * g, fb * b, fa]);
  }

  await document.transform(flatten(), weld());
  bake(document);
  const angle = ((spec.turn ?? 0) * Math.PI) / 2;
  const scale = spec.scale ?? 1;
  if (angle || scale !== 1) {
    const c = Math.cos(angle) * scale;
    const s = Math.sin(angle) * scale;
    // About y, anticlockwise seen from above (from +y): x → −z; column-major.
    const matrix = [c, 0, -s, 0, 0, scale, 0, 0, s, 0, c, 0, 0, 0, 0, 1];
    for (const mesh of root.listMeshes()) transformMesh(mesh, matrix as never);
  }

  // IKEA's models come ready for the web: only the woven ones are simplified, the rest keep their curves.
  const simplified = !("ikea" in spec.source) || WOVEN.has(spec.id) || SLOPPY.has(spec.id);
  const ratio = simplified ? Math.min(1, spec.triangles / Math.max(triangles(document), 1)) : 1;
  await document.transform(
    joinPrimitives(),
    weld(),
    simplify({
      simplifier: MeshoptSimplifier,
      ratio,
      error: spec.error ?? (WOVEN.has(spec.id) ? 0.04 : 0.002),
      lockBorder: false,
    }),
  );
  if (SLOPPY.has(spec.id) && triangles(document) > spec.triangles * 1.5) {
    sloppy(document, spec.triangles);
  }
  if (spec.top) drawIn(document, spec.top);
  if (spec.bedding) makeBed(document);
  await document.transform(center({ pivot: "below" }), dedup(), prune());
  bake(document);
  // Draco was only for reading: the versions are written with meshopt.
  root
    .listExtensionsUsed()
    .filter((extension) => extension.extensionName === "KHR_draco_mesh_compression")
    .forEach((extension) => extension.dispose());
  return document;
}

/**
 * Simplifies a piece of many loose parts (strands of rattan, slats, cords) the simplifier cannot
 * collapse while it keeps each part: it merges what lies within the error, as a voxel grid would.
 */
function sloppy(document: Document, target: number) {
  const share = target / triangles(document);
  for (const mesh of document.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      const indices = primitive.getIndices();
      const position = primitive.getAttribute("POSITION");
      if (!indices || !position) continue;
      const positions = Float32Array.from(position.getArray() ?? []);
      const [kept] = MeshoptSimplifier.simplifySloppy(
        Uint32Array.from(indices.getArray() ?? []),
        positions,
        3,
        null,
        Math.max(3, Math.floor((indices.getCount() * share) / 3) * 3),
        0.02,
      );
      indices.setArray(new Uint32Array(kept));
      compactPrimitive(primitive);
    }
  }
}

/** Draws in whatever stands above a height down to it: a pendant's cord, to hang it shorter. */
function drawIn(document: Document, top: number) {
  const bottom = getBounds(document.getRoot().listScenes()[0]!).min[1];
  for (const mesh of document.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      const position = primitive.getAttribute("POSITION");
      if (!position) continue;
      const p = [0, 0, 0];
      for (let i = 0; i < position.getCount(); i++) {
        position.getElement(i, p);
        if (p[1]! - bottom > top) position.setElement(i, [p[0]!, bottom + top, p[2]!]);
      }
    }
  }
}

/** A box with rounded edges, as a mesh's points, normals and triangles: soft, for fabric. */
function softBox(w: number, h: number, d: number, radius: number, segments = 3) {
  const half = [w / 2, h / 2, d / 2] as const;
  const r = Math.min(radius, ...half.map((v) => v * 0.98));
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  // Each face of the box, a grid of points, pushed out onto the rounded box.
  const faces: [number, number, number, number][] = [
    // axis, sign, u-axis, v-axis
    [0, 1, 2, 1],
    [0, -1, 1, 2],
    [1, 1, 0, 2],
    [1, -1, 2, 0],
    [2, 1, 1, 0],
    [2, -1, 0, 1],
  ];
  const n = segments * 2;
  for (const [axis, sign, ua, va] of faces) {
    const base = positions.length / 3;
    for (let i = 0; i <= n; i++) {
      for (let j = 0; j <= n; j++) {
        const p = [0, 0, 0];
        p[axis] = sign * half[axis]!;
        p[ua] = (i / n - 0.5) * 2 * half[ua]!;
        p[va] = (j / n - 0.5) * 2 * half[va]!;
        const inner = p.map((v, k) => Math.max(-half[k]! + r, Math.min(half[k]! - r, v)));
        const out = p.map((v, k) => v - inner[k]!);
        const length = Math.hypot(...out) || 1;
        const normal = out.map((v) => v / length);
        positions.push(...inner.map((v, k) => v + normal[k]! * r));
        normals.push(...normal);
      }
    }
    // Wound so the face looks out: its first triangle's turn checked against the face's way.
    const point = (k: number) => [0, 1, 2].map((c) => positions[k * 3 + c]!);
    const [p0, p1, p2] = [point(base), point(base + n + 1), point(base + 1)];
    const e1 = p1.map((v, k) => v - p0[k]!);
    const e2 = p2.map((v, k) => v - p0[k]!);
    const cross = [
      e1[1]! * e2[2]! - e1[2]! * e2[1]!,
      e1[2]! * e2[0]! - e1[0]! * e2[2]!,
      e1[0]! * e2[1]! - e1[1]! * e2[0]!,
    ];
    const outward = cross[axis]! * sign > 0;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const a = base + i * (n + 1) + j;
        const b = a + n + 1;
        if (outward) indices.push(a, b, a + 1, b, b + 1, a + 1);
        else indices.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
  }
  return { positions, normals, indices };
}

/** A part of the bedding: a soft box at a point, tipped about x by an angle, in its colour. */
type BeddingPart = {
  size: [number, number, number];
  radius: number;
  at: [number, number, number];
  tilt?: number;
  colour: (typeof BEDDING_COLOURS)[keyof typeof BEDDING_COLOURS];
};

const BEDDING_COLOURS = {
  /** White linen, for the sheet, the duvet and the pillows. */
  linen: "#F2EEE6",
  /** Oatmeal linen, for the cushions in front of them. */
  oatmeal: "#D8CCB6",
  /** A throw in the brand's terracotta, muted, across the foot. */
  throw: "#B47A5C",
} as const;

/**
 * Makes a bare bed frame up: a mattress over its slats, a duvet hanging over its sides, the
 * duvet's turned-down edge, pillows against the headboard, two cushions leant on them, and a throw
 * across the foot. The frame faces south: its headboard is to the north (−z).
 */
function makeBed(document: Document) {
  const root = document.getRoot();
  const scene = root.getDefaultScene() ?? root.listScenes()[0]!;
  const bounds = getBounds(scene);
  const [x0, , z0] = bounds.min;
  const [x1, , z1] = bounds.max;
  const frameW = x1 - x0;
  const cx = (x0 + x1) / 2;
  // The slats' top: the highest point in the middle of the frame, clear of its headboard and foot.
  let slats = 0;
  for (const mesh of root.listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      const position = primitive.getAttribute("POSITION");
      if (!position) continue;
      const p = [0, 0, 0];
      for (let i = 0; i < position.getCount(); i++) {
        position.getElement(i, p);
        const inX = Math.abs(p[0]! - cx) < frameW * 0.3;
        const inZ = p[2]! > z0 + (z1 - z0) * 0.3 && p[2]! < z0 + (z1 - z0) * 0.8;
        if (inX && inZ) slats = Math.max(slats, p[1]!);
      }
    }
  }
  // A 160 or a 90 cm mattress, 2 m long, against the foot.
  const mattressW = Math.floor((frameW - 0.1) * 10) / 10;
  const mattressL = 2;
  const foot = z1 - 0.04;
  const head = foot - mattressL;
  const top = slats + 0.22;
  const double = mattressW >= 1.2;
  const parts: BeddingPart[] = [
    {
      size: [mattressW, 0.22, mattressL],
      radius: 0.05,
      at: [cx, slats + 0.11, foot - mattressL / 2],
      colour: BEDDING_COLOURS.linen,
    },
    // The duvet from below the pillows to the foot, hanging over the sides.
    {
      size: [mattressW + 0.1, 0.3, mattressL - 0.5],
      radius: 0.06,
      at: [cx, top - 0.1, foot - (mattressL - 0.5) / 2 + 0.03],
      colour: BEDDING_COLOURS.linen,
    },
    // Its edge turned down.
    {
      size: [mattressW + 0.11, 0.07, 0.3],
      radius: 0.035,
      at: [cx, top + 0.075, head + 0.65],
      colour: BEDDING_COLOURS.linen,
    },
    // The throw across the foot.
    {
      size: [mattressW + 0.14, 0.035, 0.5],
      radius: 0.015,
      at: [cx, top + 0.07, foot - 0.32],
      colour: BEDDING_COLOURS.throw,
    },
  ];
  const pillows = double ? 2 : 1;
  const pillowW = double ? (mattressW - 0.16) / 2 : mattressW - 0.2;
  for (let i = 0; i < pillows; i++) {
    const x = cx + (pillows === 1 ? 0 : (i - 0.5) * (pillowW + 0.06));
    parts.push(
      {
        size: [pillowW, 0.16, 0.45],
        radius: 0.07,
        at: [x, top + 0.09, head + 0.28],
        tilt: -0.35,
        colour: BEDDING_COLOURS.linen,
      },
      {
        size: [double ? 0.45 : 0.4, 0.4, 0.13],
        radius: 0.06,
        at: [x, top + 0.2, head + 0.5],
        tilt: 0.3,
        colour: BEDDING_COLOURS.oatmeal,
      },
    );
  }

  const buffer = root.listBuffers()[0] ?? document.createBuffer();
  const materials = new Map(
    Object.entries(BEDDING_COLOURS).map(([name, colour]) => {
      const [r, g, b] = [1, 3, 5].map(
        (at) => (parseInt(colour.slice(at, at + 2), 16) / 255) ** 2.2,
      ) as [number, number, number];
      return [
        colour,
        document
          .createMaterial(`bedding-${name}`)
          .setBaseColorFactor([r, g, b, 1])
          .setRoughnessFactor(0.92)
          .setMetallicFactor(0),
      ];
    }),
  );
  const mesh = document.createMesh("bedding");
  for (const part of parts) {
    const box = softBox(...part.size, part.radius);
    const tilt = part.tilt ?? 0;
    const [c, s] = [Math.cos(tilt), Math.sin(tilt)];
    const turn = (v: number[], i: number, translate: boolean) => {
      const [x, y, z] = [v[i]!, v[i + 1]!, v[i + 2]!];
      const ry = y * c - z * s;
      const rz = y * s + z * c;
      return translate ? [x + part.at[0], ry + part.at[1], rz + part.at[2]] : [x, ry, rz];
    };
    const positions: number[] = [];
    const normals: number[] = [];
    for (let i = 0; i < box.positions.length; i += 3) {
      positions.push(...turn(box.positions, i, true));
      normals.push(...turn(box.normals, i, false));
    }
    const primitive = document
      .createPrimitive()
      .setAttribute(
        "POSITION",
        document
          .createAccessor()
          .setType("VEC3")
          .setArray(new Float32Array(positions))
          .setBuffer(buffer),
      )
      .setAttribute(
        "NORMAL",
        document
          .createAccessor()
          .setType("VEC3")
          .setArray(new Float32Array(normals))
          .setBuffer(buffer),
      )
      .setIndices(
        document
          .createAccessor()
          .setType("SCALAR")
          .setArray(new Uint32Array(box.indices))
          .setBuffer(buffer),
      )
      .setMaterial(materials.get(part.colour)!);
    mesh.addPrimitive(primitive);
  }
  scene.addChild(document.createNode("bedding").setMesh(mesh));
}

const triangles = (document: Document) =>
  document
    .getRoot()
    .listMeshes()
    .flatMap((mesh) => mesh.listPrimitives())
    .reduce((sum, p) => sum + (p.getIndices()?.getCount() ?? 0) / 3, 0);

/** One version of a piece: its textures cut down to WebP, compressed, written. */
async function write(document: Document, file: string, pixels: number, io: NodeIO) {
  const version = cloneDocument(document);
  version.setLogger(new Logger(Logger.Verbosity.WARN));
  await version.transform(
    textureCompress({
      encoder: sharp,
      targetFormat: "webp",
      resize: [pixels, pixels],
      quality: WEBP_QUALITY,
    }),
    meshopt({ encoder: MeshoptEncoder, level: "medium" }),
  );
  await io.write(file, version);
  return { file: `/${file.replace(/^public\//, "")}`, bytes: statSync(file).size };
}

async function build(spec: PieceSpec, io: NodeIO, offline: boolean) {
  const { path, credit } = await original(spec, offline);
  const document = await prepare(spec, path, io);
  const root = document.getRoot();
  const bounds = getBounds(root.getDefaultScene() ?? root.listScenes()[0]!);
  const [w, h, d] = [0, 1, 2].map((axis) => bounds.max[axis]! - bounds.min[axis]!) as [
    number,
    number,
    number,
  ];
  const round = (value: number) => Math.round(value * 1000) / 1000;
  return {
    piece: {
      id: spec.id,
      size: { w: round(w), h: round(h), d: round(d) },
      triangles: triangles(document),
      desktop: await write(
        document,
        join(OUT, `${spec.id}.glb`),
        texturePixels(Math.max(w, h, d), VERSIONS.desktop),
        io,
      ),
      mobile: await write(
        document,
        join(OUT, `${spec.id}.mobile.glb`),
        texturePixels(Math.max(w, h, d), VERSIONS.mobile),
        io,
      ),
      ...(spec.round && { round: true }),
    },
    credit: { id: spec.id, label: spec.label, ...credit },
  };
}

const { values } = parseArgs({ options: { offline: { type: "boolean", default: false } } });

await MeshoptEncoder.ready;
await MeshoptSimplifier.ready;
const io = new NodeIO()
  .setLogger(new Logger(Logger.Verbosity.WARN))
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    "meshopt.encoder": MeshoptEncoder,
    // IKEA's models come compressed with Draco; they are written back with meshopt.
    "draco3d.decoder": await draco3d.createDecoderModule(),
  });

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const built = [];
const kb = (bytes: number) => `${(bytes / 1024).toFixed(0).padStart(4)} KB`;
for (const spec of PIECES) {
  built.push(await build(spec, io, values.offline));
  const { piece } = built.at(-1)!;
  const { w, d, h } = piece.size;
  console.log(
    `${piece.id.padEnd(20)} ${w.toFixed(2)} × ${d.toFixed(2)} × ${h.toFixed(2)} m  ${String(piece.triangles).padStart(6)} triangles  ${kb(piece.desktop.bytes)} · ${kb(piece.mobile.bytes)} mobile`,
  );
}

const manifest: FurnitureManifest = furnitureManifestSchema.parse({
  pieces: built.map(({ piece }) => piece),
});
writeFileSync(join(OUT, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
const total = (suffix: string) =>
  readdirSync(OUT)
    .filter(
      (name) => name.endsWith(suffix) && (suffix === ".mobile.glb" || !name.includes(".mobile")),
    )
    .reduce((sum, name) => sum + statSync(join(OUT, name)).size, 0);
console.log(
  `${manifest.pieces.length} pieces: ${kb(total(".glb"))} on a desktop, ${kb(total(".mobile.glb"))} on a phone`,
);

writeFileSync(
  CREDITS,
  await format(
    [
      "# Credits",
      "",
      "Third-party assets the site serves, with their origin and licence (ADR 0007, ADR 0011, ADR 0012). The furniture is IKEA's own models, © IKEA, used without a licence and only to demonstrate the site, which sells nothing and is not affiliated with IKEA; the interface never names them. Neither the originals (`assets-src/`) nor the processed models (`public/media/furniture/*.glb`) are kept in the repository: the site serves them from outside it. The beds' mattresses and bedding are made by the script. This file is written by `npm run media:furniture`.",
      "",
      "## Furniture",
      "",
      "| Piece | File | Original | Authors | Licence |",
      "| --- | --- | --- | --- | --- |",
      ...built.map(
        ({ credit }) =>
          `| ${credit.label} | \`${credit.id}.glb\` | [${credit.name}](${credit.url}) | ${credit.authors.join(", ")} | ${credit.licence} |`,
      ),
      "",
    ].join("\n"),
    { parser: "markdown" },
  ),
);
