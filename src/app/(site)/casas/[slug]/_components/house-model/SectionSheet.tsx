"use client";

import { useEffect, useRef, type RefObject } from "react";

import type { HouseSection } from "../../_lib/house-section";
import {
  SectionFrameDrawing,
  sectionFrame,
  sectionViewBox,
  type SectionFrameId,
} from "../SectionDrawing";

/** CSS px per metre the sheet is laid out at, before the scene's camera scales it on screen. */
export const SHEET_PX_PER_METRE = 100;

/** Where the scene's camera puts the sheet, in CSS 3D, as three's CSS3DRenderer would. */
export type SheetPlacement = {
  /** The camera's focal length in CSS px: the viewport's perspective. */
  perspective: number;
  /** The canvas's size, which the camera's view takes. */
  width: number;
  height: number;
  /** The camera's view, and the drawing's place on its plane. */
  view: string;
  drawing: string;
};

export type PlaceSheet = (placement: SheetPlacement) => void;

type SectionSheetProps = {
  section: HouseSection;
  frame: SectionFrameId;
  /** Where the sheet leaves the function that places it, for the scene to call every frame. */
  placeRef: RefObject<PlaceSheet | null>;
};

/**
 * The corte's SVG as a sheet in the scene: on the plane the house is cut by, over the canvas, in
 * CSS 3D with the scene's own camera. Its viewport takes the camera's perspective, the next element
 * the camera's view, and the drawing its place on the plane. A picture of the poster under it,
 * which says what it is: hidden from readers.
 */
export function SectionSheet({ section, frame, placeRef }: SectionSheetProps) {
  const viewport = useRef<HTMLDivElement>(null);
  const view = useRef<HTMLDivElement>(null);
  const drawing = useRef<HTMLDivElement>(null);
  const sheet = sectionFrame(section, frame);
  const box = sectionViewBox(section, sheet);

  useEffect(() => {
    placeRef.current = ({ perspective, width, height, view: camera, drawing: plane }) => {
      if (!viewport.current || !view.current || !drawing.current) return;
      viewport.current.style.perspective = `${perspective}px`;
      view.current.style.width = `${width}px`;
      view.current.style.height = `${height}px`;
      view.current.style.transform = camera;
      drawing.current.style.transform = plane;
      drawing.current.style.opacity = "1";
    };
    return () => {
      placeRef.current = null;
    };
  }, [placeRef]);

  return (
    <div
      ref={viewport}
      aria-hidden
      data-model-sheet
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <div ref={view} className="transform-3d">
        {/* Out of sight until the scene first places it. */}
        <div
          ref={drawing}
          className="absolute top-0 left-0 opacity-0"
          style={{ width: box.width * SHEET_PX_PER_METRE, height: box.height * SHEET_PX_PER_METRE }}
        >
          <SectionFrameDrawing
            section={section}
            frame={sheet}
            idPrefix="escena-"
            decorative
            className="size-full"
          />
        </div>
      </div>
    </div>
  );
}
