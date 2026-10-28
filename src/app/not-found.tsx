import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { StatusScreen } from "@/components/ui/status-screen";

export const metadata: Metadata = {
  title: "Página no encontrada",
};

// Handles every unmatched URL and notFound() from any route, inside the root layout only.
export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto w-full max-w-3xl px-6 pt-10 md:px-10">
        <Logo />
      </header>
      <main className="flex flex-1 flex-col">
        <StatusScreen
          eyebrow="Error 404"
          title="Esta página se la llevó la marea"
          message="La dirección no existe o ha cambiado. Desde la portada puedes seguir recorriendo Calma Costa."
        >
          <Button asChild>
            <Link href="/">Volver a la portada</Link>
          </Button>
        </StatusScreen>
      </main>
    </div>
  );
}
