import { ArtDirectedImage } from "@/components/ui/art-directed-image";
import { RevealText } from "@/components/ui/reveal-text";
import type { CatalogHouseType } from "@/features/houses/catalog";
import { floorPoster } from "@/features/houses/media";

type HouseFloorsProps = {
  houseType: CatalogHouseType;
};

const counter = (n: number) => String(n).padStart(2, "0");

/**
 * One stretch per floor, in order, with its still and the slot where Phase 4 connects its guided
 * tour. House types without tours yet say «Tour próximamente».
 */
export function HouseFloors({ houseType: { slug, floors, hasTour } }: HouseFloorsProps) {
  return (
    // aria-label, not aria-labelledby: the title's hidden moving copy would be read twice.
    <section
      id="recorre"
      aria-label="Recorre la casa"
      className="flex scroll-mt-24 flex-col gap-4 md:gap-8"
    >
      <div className="mx-auto w-full max-w-7xl px-6 md:px-10">
        <RevealText as="h2" className="type-display-l text-ink">
          Recorre la casa
        </RevealText>
      </div>
      <ol className="flex flex-col gap-2 px-2 md:gap-4 md:px-4">
        {floors.map((floor, index) => {
          const poster = floorPoster(slug, floor.id);
          return (
            <li key={floor.id} id={`planta-${floor.id}`}>
              <article
                aria-labelledby={`planta-${floor.id}-titulo`}
                className="relative isolate flex h-svh flex-col justify-end overflow-hidden bg-piedra"
              >
                <ArtDirectedImage
                  desktop={poster.desktop}
                  mobile={poster.mobile}
                  className="-z-10"
                />
                <div aria-hidden className="absolute inset-0 -z-10 bg-scrim" />
                {/* Phase 4 mounts the floor's scroll-scrubbed tour here. */}
                <div data-tour-slot={floor.id} hidden />
                <div className="flex max-h-[40%] flex-col items-start gap-3 p-6 on-media md:p-16">
                  <p className="type-eyebrow">
                    {counter(index + 1)} / {counter(floors.length)}
                  </p>
                  <h3 id={`planta-${floor.id}-titulo`} className="type-display-l">
                    {floor.name}
                  </h3>
                  {!hasTour && (
                    <p className="rounded-full border border-current px-4 py-1 type-small font-semibold">
                      Tour próximamente
                    </p>
                  )}
                </div>
              </article>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
