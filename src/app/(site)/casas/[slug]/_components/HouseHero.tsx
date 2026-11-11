import { ArtDirectedImage } from "@/components/ui/art-directed-image";
import type { CatalogHouseType } from "@/features/houses/catalog";
import { HouseTypeMorph } from "@/features/houses/components/HouseTypeMorph";
import { houseTypeImages } from "@/features/houses/media";

type HouseHeroProps = {
  houseType: CatalogHouseType;
};

/**
 * The house at full screen, under the transparent header, like the landing's hero, with only its
 * name over it: the presentation below carries the text. Its frame is the card the visitor chose,
 * grown to full screen (HouseTypeCard).
 */
export function HouseHero({ houseType: { slug, name } }: HouseHeroProps) {
  const { hero } = houseTypeImages(slug);
  return (
    <section
      aria-label={name}
      data-header-overlay
      data-house-hero
      // The header adds the same inset (pt-2 md:pt-4) while it sits over this frame.
      className="h-svh p-2 md:p-4"
    >
      <HouseTypeMorph slug={slug}>
        <div className="@container relative isolate h-full overflow-hidden bg-piedra">
          <ArtDirectedImage desktop={hero.desktop} mobile={hero.mobile} eager className="-z-10" />
          {/* Decorative name, translucent over the image: the h1 is in the presentation below.
              As wide as the image whatever its length: «Villa Mar» at 21 % of it, a longer name
              smaller, so «Villa Duna Blanca» is never cut. */}
          <p
            aria-hidden
            className="absolute inset-x-0 top-[calc(var(--header-height)+2rem)] text-center type-display-xl whitespace-nowrap on-media opacity-60 md:top-[calc(var(--header-height)+3rem)]"
            style={{ fontSize: `${Math.min(21, 189 / name.length)}cqw` }}
          >
            {name}
          </p>
        </div>
      </HouseTypeMorph>
    </section>
  );
}
