import Image from "next/image";
import Link from "next/link";

import {
  houseTypePath,
  keyFiguresLabel,
  offerLabel,
  type CatalogHouseType,
} from "@/features/houses/catalog";
import { houseTypeImages } from "@/features/houses/media";
import { cn } from "@/lib/utils";

import { HouseTypeMorph } from "./HouseTypeMorph";

type HouseTypeCardProps = {
  houseType: CatalogHouseType;
  /** The image's `sizes`, as wide as the card is laid out. */
  sizes: string;
};

/**
 * A house type and the way to its page: its image with, over the scrim, its kind, name, key
 * figures and price from (or «Agotada»), and «Tour próximamente» while it has no tour.
 *
 * The link is the name, so its accessible name is what it shows (WCAG 2.5.3); the rest is its
 * description. It stretches over the whole card (`::after`), which also draws its focus ring.
 *
 * It fills its parent. Whoever lays it out can light or dim its image (`data-card-image`).
 * Choosing it morphs the whole card into its page's hero, and back (HouseHero).
 */
export function HouseTypeCard({ houseType, sizes }: HouseTypeCardProps) {
  const { slug, title, kind, figures, hasTour, availability } = houseType;
  const id = `house-type-${slug}`;

  return (
    <HouseTypeMorph slug={slug}>
      <div className="relative isolate flex h-full flex-col justify-end overflow-hidden rounded-card bg-piedra md:rounded-hero">
        <Image
          src={houseTypeImages(slug).card.portrait}
          alt=""
          fill
          sizes={sizes}
          data-card-image
          className="-z-10 object-cover"
        />
        <div aria-hidden className="absolute inset-0 -z-10 bg-scrim" />
        {/* The scrim's text zone is the bottom 40 %: the text stays inside it. */}
        <div className="flex max-h-[40%] flex-col gap-3 p-6 on-media lg:p-10">
          <p id={`${id}-kind`} className="type-eyebrow">
            {kind}
          </p>
          <h3 className="type-statement">
            <Link
              href={houseTypePath(slug)}
              // The house itself, not only the route's shell: the morph needs its hero in the
              // same commit as the navigation, not after a loading screen.
              prefetch
              aria-describedby={`${id}-kind ${id}-details`}
              className={cn(
                "outline-none after:absolute after:inset-0 after:rounded-card md:after:rounded-hero",
                // Inset, or the card's overflow would clip it.
                "focus-visible:after:outline-2 focus-visible:after:-outline-offset-4 focus-visible:after:outline-ring focus-visible:after:outline-solid",
              )}
            >
              {title.lead} {title.accent}
            </Link>
          </h3>
          <div id={`${id}-details`} className="flex flex-col gap-3">
            <p className="type-small">{keyFiguresLabel(figures)}</p>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="type-price">{offerLabel(availability)}</p>
              {!hasTour && (
                <p className="rounded-full border border-current px-4 py-1 type-small font-semibold">
                  Tour próximamente
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </HouseTypeMorph>
  );
}
