"use client"; // Error boundaries must be Client Components.

import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { StatusScreen } from "@/components/ui/status-screen";

import { landingSections, sectionHref } from "../../_lib/sections";

type HouseErrorProps = {
  error: unknown;
  retry: () => void;
};

export default function HouseError({ error, retry }: HouseErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatusScreen
      eyebrow="Algo ha fallado"
      title="Esta casa no ha terminado de cargar"
      message="Inténtalo de nuevo en un momento, o vuelve a las casas para elegir otra."
      // Clear the fixed site header, which stays on screen above this page.
      className="pt-[calc(var(--header-height)+--spacing(16))] md:pt-[calc(var(--header-height)+--spacing(28))]"
    >
      {/* No primary button: on a house page the header's "Pedir visita" is secondary. */}
      <Button type="button" variant="secondary" onClick={() => retry()}>
        Reintentar
      </Button>
      <Button asChild variant="ghost">
        <Link href={sectionHref(landingSections.houseTypes)}>Volver a las casas</Link>
      </Button>
    </StatusScreen>
  );
}
