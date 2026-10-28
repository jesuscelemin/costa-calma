import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { StatusScreen } from "@/components/ui/status-screen";

export const metadata: Metadata = {
  title: "Página no encontrada",
};

// Public 404, inside the site header and footer. The root not-found.tsx stays as the fallback
// for routes outside (site).
export default function SiteNotFound() {
  return (
    <StatusScreen
      eyebrow="Error 404"
      title="Esta página se la llevó la marea"
      message="La dirección no existe o ha cambiado. Desde la portada puedes seguir recorriendo Costa Calma."
      // Clear the fixed site header, which stays on screen above this page.
      className="pt-[calc(var(--header-height)+--spacing(16))] md:pt-[calc(var(--header-height)+--spacing(28))]"
    >
      {/* "Pedir visita" in the header is already this view's single primary (mar) button. */}
      <Button asChild variant="secondary">
        <Link href="/">Volver a la portada</Link>
      </Button>
    </StatusScreen>
  );
}
