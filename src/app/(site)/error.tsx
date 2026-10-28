"use client"; // Error boundaries must be Client Components.

import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { StatusScreen } from "@/components/ui/status-screen";

type SiteErrorProps = {
  error: unknown;
  retry: () => void;
};

export default function SiteError({ error, retry }: SiteErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatusScreen
      eyebrow="Algo ha fallado"
      title="Se ha levantado un poco de viento"
      message="No hemos podido cargar esta parte de la página. Inténtalo de nuevo en un momento."
      // Clear the fixed site header, which stays on screen above this page.
      className="pt-[calc(var(--header-height)+--spacing(16))] md:pt-[calc(var(--header-height)+--spacing(28))]"
    >
      {/* "Pedir visita" in the header is already this view's single primary (mar) button. */}
      <Button type="button" variant="secondary" onClick={() => retry()}>
        Reintentar
      </Button>
      <Button asChild variant="ghost">
        <Link href="/">Volver a la portada</Link>
      </Button>
    </StatusScreen>
  );
}
