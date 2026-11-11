import { RevealText } from "@/components/ui/reveal-text";
import { listHouseTypes } from "@/features/houses/catalog";
import { HouseTypeCard } from "@/features/houses/components/HouseTypeCard";

import { HouseTypeList } from "./HouseTypeList";

type HouseTypePickerProps = {
  id: string;
};

/**
 * The selection of house types, right after the flight: one card per house type, as tall panels
 * side by side on desktop and a carousel on phones (HouseTypeList).
 */
export async function HouseTypePicker({ id }: HouseTypePickerProps) {
  const houseTypes = await listHouseTypes();

  return (
    // aria-label, not aria-labelledby: the title's hidden moving copy would be read twice.
    <section id={id} aria-label="Elige tu casa" className="flex flex-col gap-10 md:gap-16">
      <div className="mx-auto grid w-full max-w-7xl gap-4 px-6 md:grid-cols-12 md:gap-x-10 md:px-10">
        <div className="flex flex-col gap-4 md:col-span-7">
          <p className="type-eyebrow text-ink-muted">Tipologías</p>
          <RevealText as="h2" id={`${id}-title`} className="type-display-l text-ink">
            Elige tu casa
          </RevealText>
        </div>
        <p className="type-body text-ink-muted md:col-span-4 md:col-start-9 md:self-end">
          Tres casas con la misma luz del sur. Acércate a cada una y entra en la que te llame.
        </p>
      </div>
      <HouseTypeList
        items={houseTypes.map((houseType) => ({
          key: houseType.slug,
          // A third of the row at rest and up to about half when it widens; most of a phone.
          card: <HouseTypeCard houseType={houseType} sizes="(width < 48rem) 80vw, 50vw" />,
        }))}
      />
    </section>
  );
}
