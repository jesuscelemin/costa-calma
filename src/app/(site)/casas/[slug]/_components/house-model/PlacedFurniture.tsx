"use client";

import { useFrame, useLoader, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import { FACING_TURN, furniturePieces, furnitureUrl } from "@/features/houses/furniture";
import type { HousePlan, PlanFloor } from "@/features/houses/schema";

import type { ModelState } from "../../_lib/model-choreography";
import { placedFurniture, type PlacedPiece } from "../../_lib/plan-sheet";
import { revealRooms } from "../../_lib/room-reveal";

import {
  fade,
  sweepPieceMaterial,
  warmFades,
  type MaterialId,
  type SweepMaterial,
} from "./model-materials";

// The furniture placed by hand in a storey's rooms (ADR 0007, ADR 0011): glTF pieces from the
// furniture script, with their pieceMaterials textures, on the house's sweep, so they are paper until their
// room is crossed and fade and lift with their floor. On a phone, their lighter version. Each
// floor's pieces load once they are about to be seen, never before the scene's first paint: the
// ground floor's and the plot's straight after it, a floor above once the walk has reached the
// one below it, or the whole house is on screen.

/**
 * A part of a piece: its geometry, its material as it came, and its drawing's lines, under its
 * node's matrix: compressed, its points are stored in a unit box the matrix scales back to metres.
 */
type PiecePart = {
  geometry: THREE.BufferGeometry;
  source: THREE.MeshStandardMaterial;
  edges: THREE.BufferGeometry | null;
  matrix: THREE.Matrix4;
};

/** How sharp an edge of a piece has to be to be drawn: softer than the house's boxes. */
const EDGE_ANGLE = 35;
/** Lower than this, a piece lies flat on the floor, as a rug does. */
const FLAT = 0.05;
/**
 * How far a rug is lifted off its floor: the pieces' depth is pushed back a little, for their
 * lines, and a rug two centimetres thick would sink under the floor's.
 */
const RUG_LIFT = 0.012;
/** A part with this many triangles or more is leaves: drawn as a mass, not line by line. */
const LEAFY = 6000;

const withMeshopt = (loader: GLTFLoader) => {
  loader.setMeshoptDecoder(MeshoptDecoder);
};

/** The parts of each piece, by its id, from its glTF. */
function useParts(pieces: string[], mobile: boolean): Map<string, PiecePart[]> {
  const gltfs = useLoader(
    GLTFLoader,
    pieces.map((id) => {
      const piece = furniturePieces[id]!;
      return furnitureUrl((mobile ? piece.mobile : piece.desktop).file);
    }),
    withMeshopt,
  );
  const parts = useMemo(
    () =>
      new Map(
        pieces.map((id, i): [string, PiecePart[]] => {
          const scene = gltfs[i]!.scene;
          scene.updateMatrixWorld(true);
          const found: PiecePart[] = [];
          scene.traverse((child) => {
            if (!(child instanceof THREE.Mesh)) return;
            const source = child.material;
            if (!(source instanceof THREE.MeshStandardMaterial)) return;
            const geometry = child.geometry as THREE.BufferGeometry;
            const triangles = (geometry.index?.count ?? 0) / 3;
            found.push({
              geometry,
              source,
              edges: triangles >= LEAFY ? null : new THREE.EdgesGeometry(geometry, EDGE_ANGLE),
              matrix: child.matrixWorld.clone(),
            });
          });
          return [id, found];
        }),
      ),
    [pieces, gltfs],
  );
  useEffect(
    () => () => {
      for (const found of parts.values()) for (const { edges } of found) edges?.dispose();
    },
    [parts],
  );
  return parts;
}

/**
 * The pieces' materials on this floor's sweep, one for each of theirs: shared by every piece that
 * shares it, faded with the floor.
 */
function usePieceMaterials(parts: Map<string, PiecePart[]>, paper: SweepMaterial) {
  const made = useMemo(() => {
    const sources = new Set([...parts.values()].flat().map(({ source }) => source));
    const clipping = paper.clippingPlanes ?? [];
    return new Map(
      [...sources].map((source) => [
        source,
        sweepPieceMaterial(source, paper.userData.sweep, clipping, paper.userData.paperColor),
      ]),
    );
  }, [parts, paper]);
  useEffect(
    () => () => {
      // Its textures are the loader's, kept for when the floor comes back.
      for (const material of made.values()) material.dispose();
    },
    [made],
  );
  return made;
}

type PiecesProps = {
  pieces: PlacedPiece[];
  floorId: string;
  level: number;
  materials: Record<MaterialId, SweepMaterial>;
  lines: THREE.LineBasicMaterial;
  mobile: boolean;
  state: RefObject<ModelState>;
};

function Pieces({ pieces, floorId, level, materials, lines, mobile, state }: PiecesProps) {
  const ids = useMemo(() => [...new Set(pieces.map(({ piece }) => piece))], [pieces]);
  const parts = useParts(ids, mobile);
  const pieceMaterials = usePieceMaterials(parts, materials.lime);
  // In: their programs built, as they are and as they fade, and drawn: the scene only renders on
  // demand.
  const group = useRef<THREE.Group>(null);
  const { invalidate, gl, camera, scene } = useThree();
  useEffect(() => {
    const holder = group.current;
    if (holder) warmFades(gl, holder, camera, scene);
    invalidate();
  }, [invalidate, gl, camera, scene, pieceMaterials]);
  useFrame(() => {
    const opacity = state.current.floors.find(({ id }) => id === floorId)?.opacity ?? 1;
    for (const material of pieceMaterials.values()) fade(material, opacity);
  });
  return (
    <group ref={group}>
      {pieces.map((placed) => (
        <group
          key={placed.id}
          name={`piece:${placed.id}`}
          position={[placed.x, level + placed.y + (placed.h < FLAT ? RUG_LIFT : 0), placed.z]}
          rotation={[0, FACING_TURN[placed.facing], 0]}
        >
          {(parts.get(placed.piece) ?? []).map(({ geometry, source, edges, matrix }, i) => (
            <group key={i} matrix={matrix} matrixAutoUpdate={false}>
              <mesh
                name="piece"
                geometry={geometry}
                material={pieceMaterials.get(source)}
                castShadow
                receiveShadow
              />
              {edges && <lineSegments name="lines" geometry={edges} material={lines} />}
            </group>
          ))}
        </group>
      ))}
    </group>
  );
}

/** Whether a floor's furniture is about to be seen, from the state of the scene. */
function furnitureDue(plan: HousePlan, index: number, state: ModelState) {
  // The plot and the ground floor: from the start, after the first paint.
  if (index <= 1) return true;
  if (state.phase === "finale" || state.phase === "floor" || state.phase === "room") return true;
  // A floor above: once the walk has swept a room of the one below it.
  const below = plan.floors[index - 1]?.id;
  const rooms = revealRooms(plan);
  return state.rooms.some(({ reveal }, i) => reveal > 0 && rooms[i]?.floor.id === below);
}

/**
 * A storey's furniture placed by hand, the plot's porch and terraces' with the ground floor's,
 * loaded when it is about to be seen.
 */
export function PlacedFurniture({
  plan,
  floor,
  ...props
}: Omit<PiecesProps, "pieces" | "floorId"> & { plan: HousePlan; floor: PlanFloor }) {
  const pieces = useMemo(() => placedFurniture(plan, floor), [plan, floor]);
  const index = plan.floors.indexOf(floor);
  const [load, setLoad] = useState(false);
  useFrame(() => {
    // Set once, from a frame: the first is the scene's first paint.
    if (!load && pieces.length > 0 && furnitureDue(plan, index, props.state.current)) setLoad(true);
  });
  if (!load) return null;
  return (
    <Suspense fallback={null}>
      <Pieces pieces={pieces} floorId={floor.id} {...props} />
    </Suspense>
  );
}
