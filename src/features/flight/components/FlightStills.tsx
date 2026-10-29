import { ArtDirectedImage } from "@/components/ui/art-directed-image";

import { flightManifest } from "../manifest";

const { chapters } = flightManifest;

type FlightStillsProps = {
  /** Index of the chapter the scroll is in. */
  active: number;
};

/**
 * The motionless flight: one still per chapter, each fading in over the one before as its chapter
 * starts, with the scroll (`scrub-still`). Decorative: the chapters' text tells the same story.
 */
export function FlightStills({ active }: FlightStillsProps) {
  return (
    <div aria-hidden className="absolute inset-0">
      {chapters.map(({ id, still }, index) => (
        <ArtDirectedImage
          key={id}
          desktop={still.desktop}
          mobile={still.mobile}
          data-active={index === active || undefined}
          data-passed={index < active || undefined}
          className="scrub-still"
        />
      ))}
    </div>
  );
}
