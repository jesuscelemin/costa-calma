import { getImageProps } from "next/image";

import { MOBILE_QUERY } from "@/lib/use-media-query";

import { flightManifest } from "../manifest";

const { chapters } = flightManifest;

/** Decorative and as large as the frame. */
const imageProps = { alt: "", fill: true, sizes: "100vw" };

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
      {chapters.map(({ id, still }, index) => {
        const {
          props: { srcSet: mobile },
        } = getImageProps({ ...imageProps, src: still.mobile });
        const { props } = getImageProps({ ...imageProps, src: still.desktop });
        return (
          <picture
            key={id}
            data-active={index === active || undefined}
            data-passed={index < active || undefined}
            className="absolute inset-0 scrub-still"
          >
            <source media={MOBILE_QUERY} srcSet={mobile} />
            <img {...props} alt="" className="object-cover" />
          </picture>
        );
      })}
    </div>
  );
}
