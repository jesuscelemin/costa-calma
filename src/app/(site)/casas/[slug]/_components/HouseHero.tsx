import { ArtDirectedImage } from "@/components/ui/art-directed-image";
import type { CatalogHouseType } from "@/features/houses/catalog";
import { HouseTypeMorph } from "@/features/houses/components/HouseTypeMorph";
import { houseTypeImages } from "@/features/houses/media";
import { formatPrice } from "@/lib/format";

type HouseHeroProps = {
  houseType: CatalogHouseType;
};

/**
 * The house at full screen, under the transparent header, like the landing's hero: its giant name
 * over the photograph, with its kind and price (ADR 0014). All of it is repeated in the
 * presentation below, where the h1 is, so here it is hidden from screen readers. Its frame is the
 * card the visitor chose, grown to full screen (HouseTypeCard).
 */
export function HouseHero({ houseType: { slug, name, kind, availability } }: HouseHeroProps) {
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
        <div className="@container relative isolate flex h-full flex-col justify-end overflow-hidden bg-piedra">
          <ArtDirectedImage desktop={hero.desktop} mobile={hero.mobile} eager className="-z-10" />
          <div aria-hidden className="absolute inset-0 -z-10 bg-scrim" />
          {/* Under the header, whose controls lie on the image in light text. */}
          <div aria-hidden className="absolute inset-x-0 top-0 -z-10 h-40 bg-scrim-top" />
          {/* The scrim's text zone is the bottom 40 %: the text stays inside it. */}
          <div
            aria-hidden
            className="flex max-h-[40%] flex-col gap-4 p-6 on-media md:gap-6 md:p-16"
          >
            {/* As wide as the frame whatever its length: a short name at 19 % of it, a longer one
                smaller, so «Villa Duna Blanca» is never cut. */}
            <p
              className="-ml-[0.04em] type-display-xl whitespace-nowrap"
              style={{ fontSize: `${Math.min(19, 160 / name.length)}cqw` }}
            >
              {name}
            </p>
            <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-2 border-t border-on-media/40 pt-4">
              <p className="type-eyebrow">{kind}</p>
              {availability.priceFrom !== null && (
                <p className="flex items-baseline gap-3">
                  <span className="type-small">precio desde</span>
                  <span className="type-price">{formatPrice(availability.priceFrom)}</span>
                </p>
              )}
            </div>
          </div>
        </div>
      </HouseTypeMorph>
    </section>
  );
}
