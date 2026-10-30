import { BackToHouses } from "./BackToHouses";

type HouseOutroProps = {
  slug: string;
};

/** The end of the walk through a house: the way back to the other house types. */
export function HouseOutro({ slug }: HouseOutroProps) {
  return (
    <section
      aria-label="Otras casas"
      className="mx-auto flex w-full max-w-7xl flex-col items-center gap-10 px-6 text-center md:px-10"
    >
      <p className="max-w-3xl type-statement text-ink">
        <span className="text-ink-muted">Hasta aquí esta casa.</span> Las otras te esperan junto a
        la misma playa.
      </p>
      <BackToHouses slug={slug} />
    </section>
  );
}
