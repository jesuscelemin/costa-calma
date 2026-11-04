// Builds the house models' furniture into public/media/furniture/ (ADR 0007): CC0 glTF pieces from
// Poly Haven, downloaded into assets-src/ (outside git), stripped to their geometry, simplified,
// compressed with meshopt, and their parts named after the house's own materials, which paint
// them in code with the sweep (ADR 0006). Writes one .glb per piece, the manifest the plan's
// furniture is checked against, and the credits in docs/credits.md.
//
//   npm run media:furniture            downloads what is missing, then rebuilds every piece
//   npm run media:furniture -- --offline   only from what assets-src/ already has
//
// Each piece faces south (+z) once built, stands on y = 0 and is centred on its footprint.

import { existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";

import {
  type Document,
  Logger,
  type Material,
  Mesh,
  NodeIO,
  Primitive,
  PropertyType,
  getBounds,
} from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import {
  center,
  clearNodeTransform,
  dedup,
  flatten,
  join as joinPrimitives,
  meshopt,
  prune,
  simplify,
  transformMesh,
  weld,
} from "@gltf-transform/functions";
import { MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";

import {
  type FurnitureManifest,
  type FurnitureMaterial,
  furnitureManifestSchema,
} from "../../src/features/houses/furniture-manifest.ts";

type PieceSpec = {
  /** Our id, as the plan names it. */
  id: string;
  /** Poly Haven's id. */
  source: string;
  /** What the piece is, for the credits. */
  label: string;
  /** Each of the source's materials, as one of the house's. */
  materials: Record<string, FurnitureMaterial>;
  /** What stands above this height, in metres, takes another material: a table's top. */
  above?: { y: number; material: FurnitureMaterial };
  /** Quarter turns anticlockwise, seen from above, for its front to face south. */
  turn?: 0 | 1 | 2 | 3;
  /** At most this many triangles. */
  triangles: number;
  /** Drawn on the plan as a circle, not a rectangle. */
  round?: boolean;
};

const PIECES: PieceSpec[] = [
  {
    id: "armchair",
    source: "modern_arm_chair_01",
    label: "Butaca",
    materials: { modern_arm_chair_01_legs: "oak", modern_arm_chair_01_pillow: "fabric" },
    triangles: 3000,
  },
  {
    id: "lounge-chair",
    source: "mid_century_lounge_chair",
    label: "Butaca giratoria",
    // Its swivel base dark metal, its shell and cushions upholstered.
    materials: { mid_century_lounge_chair: "frame" },
    above: { y: 0.3, material: "fabric" },
    triangles: 3000,
  },
  {
    id: "coffee-table",
    source: "modern_coffee_table_01",
    label: "Mesa baja",
    materials: { modern_coffee_table_01: "oak" },
    above: { y: 0.33, material: "stone" },
    turn: 1,
    triangles: 1500,
  },
  {
    id: "round-coffee-table",
    source: "coffee_table_round_01",
    label: "Mesa baja redonda",
    materials: { coffee_table_round_01: "frame" },
    above: { y: 0.43, material: "stone" },
    triangles: 1500,
    round: true,
  },
  {
    id: "sideboard",
    source: "modern_wooden_cabinet",
    label: "Aparador",
    materials: { modern_wooden_cabinet: "oak" },
    triangles: 2500,
  },
  {
    id: "side-table",
    source: "side_table_01",
    label: "Mesa auxiliar",
    materials: { side_table_01: "oak" },
    triangles: 1200,
  },
  {
    id: "nightstand",
    source: "painted_wooden_nightstand",
    label: "Mesilla",
    materials: { painted_wooden_nightstand: "oak" },
    triangles: 800,
  },
  {
    id: "shelves",
    source: "wooden_display_shelves_01",
    label: "Estantería",
    materials: { wooden_display_shelves_01: "oak" },
    turn: 1,
    triangles: 1500,
  },
  {
    id: "plant",
    source: "potted_plant_02",
    label: "Planta en maceta",
    materials: { potted_plant_02_pot: "stone", potted_plant_02_leaves: "foliage" },
    triangles: 6000,
    round: true,
  },
  {
    id: "succulent",
    source: "potted_plant_04",
    label: "Suculenta",
    materials: { potted_plant_04: "foliage" },
    triangles: 1500,
    round: true,
  },
  {
    id: "vase",
    source: "ceramic_vase_01",
    label: "Jarrón",
    materials: { ceramic_vase_01: "lime" },
    triangles: 800,
    round: true,
  },
  {
    id: "pendant",
    source: "modern_ceiling_lamp_01",
    label: "Lámpara colgante",
    materials: {
      modern_ceiling_lamp_01: "frame",
      modern_ceiling_lamp_01_glass: "lime",
      modern_ceiling_globe: "lime",
    },
    triangles: 1500,
    round: true,
  },
  {
    id: "cushions",
    source: "throw_pillows_01",
    label: "Cojines",
    materials: { throw_pillows_01: "fabric" },
    triangles: 1500,
  },
];

const SOURCES = "assets-src/polyhaven";
const OUT = "public/media/furniture";
const CREDITS = "docs/credits.md";
const RESOLUTION = "1k";
const USER_AGENT = "costa-calma-build";

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

/** The piece's original glTF in assets-src/, downloaded if it is not there yet. */
async function original(source: string, offline: boolean): Promise<string> {
  const dir = join(SOURCES, source);
  const main = join(dir, `${source}.gltf`);
  if (offline || existsSync(main)) {
    if (!existsSync(main)) throw new Error(`${main} is missing; run without --offline`);
    return main;
  }
  const files = await json<PolyHavenFiles>(`https://api.polyhaven.com/files/${source}`);
  const gltf = files.gltf[RESOLUTION]?.gltf;
  if (!gltf) throw new Error(`${source} has no ${RESOLUTION} glTF`);
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

/** Splits a primitive's triangles at a height: those whose middle stands above it take `material`. */
function splitAbove(document: Document, primitive: Primitive, y: number, material: Material) {
  const indices = primitive.getIndices();
  const position = primitive.getAttribute("POSITION");
  if (!indices || !position) return;
  const below: number[] = [];
  const over: number[] = [];
  const point: number[] = [];
  for (let i = 0; i < indices.getCount(); i += 3) {
    let height = 0;
    for (let k = 0; k < 3; k++) height += position.getElement(indices.getScalar(i + k), point)[1]!;
    (height / 3 > y ? over : below).push(
      indices.getScalar(i),
      indices.getScalar(i + 1),
      indices.getScalar(i + 2),
    );
  }
  if (over.length === 0 || below.length === 0) {
    if (below.length === 0) primitive.setMaterial(material);
    return;
  }
  const buffer = document.getRoot().listBuffers()[0]!;
  const accessor = (list: number[]) =>
    document.createAccessor().setType("SCALAR").setArray(new Uint32Array(list)).setBuffer(buffer);
  indices.dispose();
  primitive.setIndices(accessor(below));
  const top = primitive.clone().setIndices(accessor(over)).setMaterial(material);
  for (const mesh of primitive.listParents()) {
    if (mesh instanceof Mesh) mesh.addPrimitive(top);
  }
}

async function build(spec: PieceSpec, io: NodeIO, offline: boolean) {
  const document = await io.read(await original(spec.source, offline));
  document.setLogger(new Logger(Logger.Verbosity.WARN));
  const root = document.getRoot();

  // Geometry only: the house paints it in code.
  for (const texture of root.listTextures()) texture.dispose();
  for (const mesh of root.listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      for (const semantic of primitive.listSemantics()) {
        if (semantic !== "POSITION" && semantic !== "NORMAL")
          primitive.setAttribute(semantic, null);
      }
    }
  }

  // One material per house material, named after it.
  const ours = new Map<FurnitureMaterial, Material>();
  const material = (id: FurnitureMaterial) => {
    let made = ours.get(id);
    if (!made) {
      made = document.createMaterial(id);
      ours.set(id, made);
    }
    return made;
  };
  for (const source of root.listMaterials()) {
    if (ours.has(source.getName() as FurnitureMaterial)) continue;
    const id = spec.materials[source.getName()];
    if (!id) throw new Error(`${spec.id}: material "${source.getName()}" has no house material`);
    const target = material(id);
    for (const parent of source.listParents()) {
      if (parent instanceof Primitive) parent.setMaterial(target);
    }
    source.dispose();
  }

  // Everything in the scene's own metres, turned to face south.
  await document.transform(flatten(), weld());
  for (const node of root.listNodes()) clearNodeTransform(node);
  if (spec.turn) {
    const angle = (spec.turn * Math.PI) / 2;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    // About y, anticlockwise seen from above (from +y): x → −z.
    const rotation = [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1] as const;
    for (const mesh of root.listMeshes()) transformMesh(mesh, [...rotation] as never);
  }
  if (spec.above) {
    await document.transform(center({ pivot: "below" }));
    for (const node of root.listNodes()) clearNodeTransform(node);
    const top = material(spec.above.material);
    for (const mesh of root.listMeshes()) {
      for (const primitive of mesh.listPrimitives())
        splitAbove(document, primitive, spec.above.y, top);
    }
  }

  const triangles = () =>
    root
      .listMeshes()
      .flatMap((mesh) => mesh.listPrimitives())
      .reduce((sum, p) => sum + (p.getIndices()?.getCount() ?? 0) / 3, 0);
  const ratio = Math.min(1, spec.triangles / Math.max(triangles(), 1));
  await document.transform(
    joinPrimitives(),
    weld(),
    simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.004, lockBorder: false }),
    center({ pivot: "below" }),
    // Not the materials: they all look alike to it, and are told apart by their names.
    dedup({ propertyTypes: [PropertyType.ACCESSOR, PropertyType.MESH] }),
    prune(),
  );
  for (const node of root.listNodes()) clearNodeTransform(node);
  const bounds = getBounds(root.getDefaultScene() ?? root.listScenes()[0]!);
  const [w, h, d] = [0, 1, 2].map((axis) => bounds.max[axis]! - bounds.min[axis]!) as [
    number,
    number,
    number,
  ];
  const count = triangles();
  // What it is made of, as the file has it once processed.
  const materials = [
    ...new Set(
      root
        .listMeshes()
        .flatMap((mesh) => mesh.listPrimitives())
        .map((primitive) => primitive.getMaterial()?.getName() as FurnitureMaterial),
    ),
  ];

  await document.transform(meshopt({ encoder: MeshoptEncoder, level: "medium" }));
  const file = join(OUT, `${spec.id}.glb`);
  await io.write(file, document);

  const info = await json<PolyHavenInfo>(`https://api.polyhaven.com/info/${spec.source}`).catch(
    () => null,
  );
  const round = (value: number) => Math.round(value * 1000) / 1000;
  return {
    piece: {
      id: spec.id,
      file: `/media/furniture/${spec.id}.glb`,
      size: { w: round(w), h: round(h), d: round(d) },
      materials,
      triangles: count,
      bytes: statSync(file).size,
      ...(spec.round && { round: true }),
    },
    credit: {
      id: spec.id,
      label: spec.label,
      name: info?.name ?? spec.source,
      authors: info ? Object.keys(info.authors) : [],
      url: `https://polyhaven.com/a/${spec.source}`,
    },
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
  });

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const built = [];
for (const spec of PIECES) {
  built.push(await build(spec, io, values.offline));
  const { piece } = built.at(-1)!;
  console.log(
    `${piece.id.padEnd(20)} ${piece.size.w.toFixed(2)} × ${piece.size.d.toFixed(2)} × ${piece.size.h.toFixed(2)} m  ${String(piece.triangles).padStart(6)} triangles  ${(piece.bytes / 1024).toFixed(0).padStart(4)} KB`,
  );
}

const manifest: FurnitureManifest = furnitureManifestSchema.parse({
  pieces: built.map(({ piece }) => piece),
});
writeFileSync(join(OUT, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
const total = readdirSync(OUT).reduce((sum, name) => sum + statSync(join(OUT, name)).size, 0);
console.log(`${manifest.pieces.length} pieces, ${(total / 1024).toFixed(0)} KB in ${OUT}`);

writeFileSync(
  CREDITS,
  [
    "# Credits",
    "",
    "Third-party assets the site serves, with their origin and licence (ADR 0007). The originals are kept outside the repository, in `assets-src/`; only the processed models in `public/media/furniture/` are published. This file is written by `npm run media:furniture`.",
    "",
    "## Furniture",
    "",
    "All from [Poly Haven](https://polyhaven.com), under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/): stripped of their textures, simplified and compressed, and painted with the house's own materials.",
    "",
    "| Piece | File | Original | Authors | Licence |",
    "| --- | --- | --- | --- | --- |",
    ...built.map(
      ({ credit }) =>
        `| ${credit.label} | \`${credit.id}.glb\` | [${credit.name}](${credit.url}) | ${credit.authors.join(", ") || "Poly Haven"} | CC0 1.0 |`,
    ),
    "",
  ].join("\n"),
);
