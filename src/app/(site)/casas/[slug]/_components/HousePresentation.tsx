import { Button } from "@/components/ui/button";
import { RevealText } from "@/components/ui/reveal-text";
import { availabilityLabel, type CatalogHouseType } from "@/features/houses/catalog";
import { formatArea, formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

import { landingSections, sectionHref } from "../../../_lib/sections";

type HousePresentationProps = {
  houseType: CatalogHouseType;
};

/**
 * The house before walking through it: its name, a statement, its key figures and the offer,
 * with the view's single primary button. Figures and prices come from the catalog.
 */
export function HousePresentation({ houseType }: HousePresentationProps) {
  const { title, kind, statement, figures, availability } = houseType;
  const figureList = [
    { value: formatArea(figures.builtArea), label: "construidos" },
    { value: `${figures.bedrooms}`, label: "dormitorios" },
    // A guest toilet goes with the bathrooms, apart: «2 + 1 · baños + aseo».
    figures.toilets
      ? {
          value: `${figures.bathrooms} + ${figures.toilets}`,
          label: figures.toilets === 1 ? "baños + aseo" : "baños + aseos",
        }
      : { value: `${figures.bathrooms}`, label: "baños" },
    { value: formatArea(figures.plotArea), label: "de parcela" },
  ];

  return (
    // Not a landmark: its h1 already heads the page. (Labelling it with the RevealText title would
    // also read that title twice, its hidden moving copy included.)
    <section className="mx-auto grid w-full max-w-7xl gap-10 px-6 md:grid-cols-12 md:gap-x-10 md:gap-y-16 md:px-10">
      <div className="flex flex-col gap-4 md:col-span-5">
        <p className="type-eyebrow text-ink-muted">{kind}</p>
        <RevealText as="h1" className="type-display-l text-ink">
          {title.lead} {title.accent}
        </RevealText>
      </div>
      <p className="type-statement text-ink md:col-span-7 md:self-end">
        <span className="text-ink-muted">{statement.lead}</span> {statement.rest}
      </p>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-8 border-t border-line pt-8 md:col-span-12 md:grid-cols-4 md:gap-10">
        {figureList.map(({ value, label }) => (
          <div key={label} className="flex flex-col gap-2">
            <dt className="order-last type-small text-ink-muted">{label}</dt>
            <dd className="type-figure text-ink">{value}</dd>
          </div>
        ))}
      </dl>

      {/* On surface-raised, where every status color reaches 4.5:1 (CLAUDE.md). */}
      <div className="flex flex-col gap-6 rounded-card bg-surface-raised p-6 sm:flex-row sm:items-center sm:justify-between md:col-span-12 md:p-10">
        <div className="flex flex-col gap-1">
          {availability.priceFrom !== null && (
            <p className="type-price text-ink">
              <span className="type-body text-ink-muted">Desde </span>
              {formatPrice(availability.priceFrom)}
            </p>
          )}
          {/* Sold out, the label takes the price's place and size. */}
          <p
            className={cn(
              availability.soldOut
                ? "type-price text-vendido"
                : "type-small font-semibold text-olivo",
            )}
          >
            {availabilityLabel(availability)}
          </p>
        </div>
        <Button asChild size="lg">
          <a href={sectionHref(landingSections.visit)}>Pedir visita</a>
        </Button>
      </div>
    </section>
  );
}
