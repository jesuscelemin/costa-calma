import Image from "next/image";

import { Blinds } from "@/components/ui/blinds";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/ui/fade-in";
import { RevealImage } from "@/components/ui/reveal-image";
import { RevealText } from "@/components/ui/reveal-text";
import type { CatalogHouseType } from "@/features/houses/catalog";
import { floorPoster, houseTypeImages } from "@/features/houses/media";

import { landingSections, sectionHref } from "../../../_lib/sections";

type HouseGalleryProps = {
  houseType: CatalogHouseType;
};

/**
 * The house in photographs after the walk (ADR 0014): a staggered pair that open as they come
 * into view, one floor behind blinds, and «Ven a verla». Placeholders until the Google Flow
 * images arrive; the photographs are decorative, the plan and the tour describe the house.
 */
export function HouseGallery({ houseType }: HouseGalleryProps) {
  const { slug, name, floors } = houseType;
  const { card } = houseTypeImages(slug);
  // The floor with the most life in it: the first storey, or the only one.
  const floor = floors.find(({ kind }) => kind === "storey") ?? floors[0];

  return (
    <section
      aria-label={`${name} en imágenes`}
      className="mx-auto flex w-full max-w-7xl flex-col gap-16 px-6 md:gap-28 md:px-10"
    >
      <div className="grid gap-6 md:grid-cols-12 md:gap-10">
        <RevealImage className="aspect-[16/10] md:col-span-7">
          <Image
            src={card.landscape}
            alt=""
            fill
            sizes="(width < 48rem) 100vw, 58vw"
            className="object-cover"
          />
        </RevealImage>
        <RevealImage className="aspect-[3/4] md:col-span-4 md:col-start-9 md:mt-40">
          <Image
            src={card.portrait}
            alt=""
            fill
            sizes="(width < 48rem) 100vw, 33vw"
            className="object-cover"
          />
        </RevealImage>
      </div>

      {floor && (
        <Blinds className="aspect-[16/9] w-full">
          <Image
            src={floorPoster(slug, floor.id).desktop}
            alt=""
            fill
            sizes="(width < 80rem) 100vw, 1280px"
            className="object-cover"
          />
        </Blinds>
      )}

      <div className="flex flex-col items-start gap-6 md:items-center md:text-center">
        <RevealText as="h2" className="type-display-l text-ink">
          Ven a verla
        </RevealText>
        <FadeIn className="flex max-w-xl flex-col gap-8 md:items-center" delay={200}>
          <p className="type-body text-ink-muted">
            La casa piloto está abierta todo el año, junto a la misma playa. Elige día y te la
            enseñamos sin prisa.
          </p>
          <Button asChild variant="outline" size="lg">
            <a href={sectionHref(landingSections.visit)}>Reservar una visita</a>
          </Button>
        </FadeIn>
      </div>
    </section>
  );
}
