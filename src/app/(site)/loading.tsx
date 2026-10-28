import { Logo } from "@/components/ui/logo";

/** Route-level fallback while a public page streams; the brand loading intro arrives in Phase 2. */
export default function SiteLoading() {
  return (
    <div role="status" className="flex flex-1 items-center justify-center py-28">
      <Logo variant="mark" className="h-16 w-16 motion-safe:animate-pulse" />
      <span className="sr-only">Cargando…</span>
    </div>
  );
}
