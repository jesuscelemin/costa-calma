import { Logo } from "@/components/ui/logo";

/** While a house page streams: the brand mark breathing, clear of the fixed header. */
export default function HouseLoading() {
  return (
    <div role="status" className="flex h-svh items-center justify-center">
      <Logo variant="mark" className="h-16 w-16 motion-safe:animate-breathe" />
      <span className="sr-only">Cargando la casa…</span>
    </div>
  );
}
