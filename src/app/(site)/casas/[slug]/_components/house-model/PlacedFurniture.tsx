"use client";

import { useFrame, useLoader, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useState, type RefObject } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

import { FACING_TURN, furniturePieces } from "@/features/houses/furniture";
import type { HousePlan, PlanFloor } from "@/features/houses/schema";

import type { ModelState } from "../../_lib/model-choreography";
import { placedFurniture, type PlacedPiece } from "../../_lib/plan-sheet";
import { revealRooms } from "../../_lib/room-reveal";

import { MATERIALS, type MaterialId, type SweepMaterial } from "./model-materials";

// The furniture placed by hand in a storey's rooms (ADR 0007): glTF pieces from the furniture
// script, painted with the floor's own materials, so they are paper until their room is swept and
// fade and lift with their floor. Each floor's pieces load once they are about to be seen, never
// before the scene's first paint: the ground floor's and the plot's straight after it, a floor
// above once the walk has reached the one below it, or the whole house is on screen.

/**
 * A piece's parts: one geometry per material, with its drawing's lines, each under its node's
 * matrix: compressed, its points are stored in a unit box the matrix scales back to metres.
 */
type PiecePart = {
  id: MaterialId;
  geometry: THREE.BufferGeometry;
  edges: THREE.BufferGeometry | null;
  matrix: THREE.Matrix4;
};

/** How sharp an edge of a piece has to be to be drawn: softer than the house's boxes. */
const EDGE_ANGLE = 35;

const isMaterial = (name: string): name is MaterialId => name in MATERIALS;

const withMeshopt = (loader: GLTFLoader) => {
  loader.setMeshoptDecoder(MeshoptDecoder);
};

/** The parts of each piece, by its id, from its glTF. */
function useParts(pieces: string[]): Map<string, PiecePart[]> {
  const gltfs = useLoader(
    GLTFLoader,
    pieces.map((id) => furniturePieces.get(id)!.file),
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
            const name = (child.material as THREE.Material).name;
            if (!isMaterial(name)) return;
            found.push({
              id: name,
              geometry: child.geometry,
              // Leaves are drawn as their mass, not leaf by leaf.
              edges:
                name === "foliage" ? null : new THREE.EdgesGeometry(child.geometry, EDGE_ANGLE),
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

type PiecesProps = {
  pieces: PlacedPiece[];
  level: number;
  materials: Record<MaterialId, SweepMaterial>;
  lines: THREE.LineBasicMaterial;
};

function Pieces({ pieces, level, materials, lines }: PiecesProps) {
  const ids = useMemo(() => [...new Set(pieces.map(({ piece }) => piece))], [pieces]);
  const parts = useParts(ids);
  // In: draw them, the scene only renders on demand.
  const invalidate = useThree(({ invalidate }) => invalidate);
  useEffect(() => invalidate(), [invalidate, parts]);
  return (
    <>
      {pieces.map((placed) => {
        const piece = parts.get(placed.piece);
        if (!piece) return null;
        return (
          <group
            key={placed.id}
            name={`piece:${placed.id}`}
            position={[placed.x, level + placed.y, placed.z]}
            rotation={[0, FACING_TURN[placed.facing], 0]}
          >
            {piece.map(({ id, geometry, edges, matrix }, i) => (
              <group key={i} matrix={matrix} matrixAutoUpdate={false}>
                <mesh
                  name={id}
                  geometry={geometry}
                  material={materials[id]}
                  castShadow
                  receiveShadow
                />
                {edges && <lineSegments name="lines" geometry={edges} material={lines} />}
              </group>
            ))}
          </group>
        );
      })}
    </>
  );
}

/** Whether a floor's furniture is about to be seen, from the state of the scene. */
function wanted(plan: HousePlan, floors: PlanFloor[], index: number, state: ModelState) {
  // The plot and the ground floor: from the start, after the first paint.
  if (index <= 1) return true;
  if (state.phase === "finale" || state.phase === "floor") return true;
  // A floor above: once the walk has swept a room of the one below it.
  const below = floors[index - 1]?.id;
  const rooms = revealRooms(plan);
  return state.rooms.some(({ reveal }, i) => reveal > 0 && rooms[i]?.floor.id === below);
}

/**
 * A floor's furniture placed by hand, loaded when it is about to be seen. `floor` is a storey of
 * the plan, or the plot, whose pieces stand with the ground floor's.
 */
export function PlacedFurniture({
  plan,
  floor,
  level,
  materials,
  lines,
  state,
}: Omit<PiecesProps, "pieces"> & {
  plan: HousePlan;
  floor: PlanFloor;
  state: RefObject<ModelState>;
}) {
  const pieces = useMemo(
    () => (floor.kind === "plot" ? [] : placedFurniture(plan, floor)),
    [plan, floor],
  );
  const index = plan.floors.indexOf(floor);
  const [load, setLoad] = useState(false);
  useFrame(() => {
    // Set once, from a frame: the first is the scene's first paint.
    if (!load && pieces.length > 0 && wanted(plan, plan.floors, index, state.current)) {
      setLoad(true);
    }
  });
  if (!load) return null;
  return (
    <Suspense fallback={null}>
      <Pieces pieces={pieces} level={level} materials={materials} lines={lines} />
    </Suspense>
  );
}
