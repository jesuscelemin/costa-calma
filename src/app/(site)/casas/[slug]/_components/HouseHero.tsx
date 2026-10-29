import { ArtDirectedImage } from "@/components/ui/art-directed-image";
import type { CatalogHouseType } from "@/features/houses/catalog";
import { houseTypeImages } from "@/features/houses/media";

type HouseHeroProps = {
  houseType: CatalogHouseType;
};

/**
 * The house at full screen, under the transparent header, like the landing's hero, with only its
 * name over it: the presentation below carries the text.
 */
export function HouseHero({ houseType: { slug, name } }: HouseHeroProps) {
  const { hero } = houseTypeImages(slug);
  return (
    <section
      aria-label={name}
      data-header-overlay
      // The header adds the same inset (pt-2 md:pt-4) while it sits over this frame.
      className="h-svh p-2 md:p-4"
    >
      <div className="@container relative isolate h-full overflow-hidden rounded-hero bg-arena">
        <ArtDirectedImage desktop={hero.desktop} mobile={hero.mobile} eager className="-z-10" />
        {/* Decorative name, translucent over the image: the h1 is in the presentation below. */}
        <p
          aria-hidden
          className="absolute inset-x-0 top-[calc(var(--header-height)+2rem)] text-center type-display-xl text-[21cqw] whitespace-nowrap on-media opacity-60 md:top-[calc(var(--header-height)+3rem)]"
        >
          {name}
        </p>
      </div>
    </section>
  );
}
