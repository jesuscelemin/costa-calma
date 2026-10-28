import { Logo } from "@/components/ui/logo";

/**
 * Landing fallback while it streams; the brand loading intro arrives in Phase 2. It lives in this
 * group so it does not wrap [...rest], whose notFound() must run before streaming to answer 404.
 */
export default function LandingLoading() {
  return (
    <div role="status" className="flex flex-1 items-center justify-center py-28">
      <Logo variant="mark" className="h-16 w-16 motion-safe:animate-pulse" />
      <span className="sr-only">Cargando…</span>
    </div>
  );
}
