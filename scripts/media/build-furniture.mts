// Builds the house models' furniture into public/media/furniture/ (ADR 0007, ADR 0011): glTF
// pieces kept with their own PBR textures, from Poly Haven (downloaded into assets-src/, outside
// git) or from files left by hand in assets-src/. Each is turned to face south, scaled to metres,
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
};

// Placeholders from Poly Haven until the contemporary pieces arrive (ADR 0011).
const PIECES: PieceSpec[] = [
  {
    id: "armchair",
    source: { polyhaven: "modern_arm_chair_01" },
    label: "Butaca",
    triangles: 6000,
  },
  {
    id: "lounge-chair",
    source: { polyhaven: "mid_century_lounge_chair" },
    label: "Butaca giratoria",
    triangles: 6000,
  },
  {
    id: "coffee-table",
    source: { polyhaven: "modern_coffee_table_01" },
    label: "Mesa baja",
    turn: 1,
    triangles: 3000,
  },
  {
    id: "round-coffee-table",
    source: { polyhaven: "coffee_table_round_01" },
    label: "Mesa baja redonda",
    triangles: 3000,
    round: true,
  },
  {
    id: "sideboard",
    source: { polyhaven: "modern_wooden_cabinet" },
    label: "Aparador",
    triangles: 6000,
  },
  {
    id: "side-table",
    source: { polyhaven: "side_table_01" },
    label: "Mesa auxiliar",
    triangles: 2000,
  },
  {
    id: "nightstand",
    source: { polyhaven: "painted_wooden_nightstand" },
    label: "Mesilla",
    triangles: 1000,
  },
  {
    id: "shelves",
    source: { polyhaven: "wooden_display_shelves_01" },
    label: "Estantería",
    turn: 1,
    triangles: 3000,
  },
  {
    id: "plant",
    source: { polyhaven: "potted_plant_02" },
    label: "Planta en maceta",
    triangles: 12000,
    round: true,
  },
  {
    id: "succulent",
    source: { polyhaven: "potted_plant_04" },
    label: "Suculenta",
    triangles: 3000,
    round: true,
  },
  {
    id: "vase",
    source: { polyhaven: "ceramic_vase_01" },
    label: "Jarrón",
    triangles: 1500,
    round: true,
  },
  {
    id: "pendant",
    source: { polyhaven: "modern_ceiling_lamp_01" },
    label: "Lámpara colgante",
    triangles: 3000,
    round: true,
  },
  {
    id: "cushions",
    source: { polyhaven: "throw_pillows_01" },
    label: "Cojines",
    triangles: 3000,
  },
];

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

  const ratio = Math.min(1, spec.triangles / Math.max(triangles(document), 1));
  await document.transform(
    joinPrimitives(),
    weld(),
    simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.004, lockBorder: false }),
    center({ pivot: "below" }),
    dedup(),
    prune(),
  );
  bake(document);
  return document;
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
  .registerDependencies({ "meshopt.encoder": MeshoptEncoder });

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
      "Third-party assets the site serves, with their origin and licence (ADR 0007, ADR 0011). The originals are kept outside the repository, in `assets-src/`; only the processed models in `public/media/furniture/` are published: simplified, their textures cut down to WebP and compressed. This file is written by `npm run media:furniture`.",
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
