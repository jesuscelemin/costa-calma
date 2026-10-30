import { Logo } from "@/components/ui/logo";

/** While a house page streams, under its hero (in the layout): the brand mark breathing. */
export default function HouseLoading() {
  return (
    <div role="status" className="flex h-svh items-center justify-center">
      <Logo variant="mark" className="h-16 w-16 motion-safe:animate-breathe" />
      <span className="sr-only">Cargando la casa…</span>
    </div>
  );
}
