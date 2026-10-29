"use client";

import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";

import { landingSections, sectionHref } from "../_lib/sections";

/**
 * The header's "Pedir visita". It is the view's single primary button, except on a house page,
 * whose presentation has its own: there the header's steps back to secondary.
 */
export function HeaderVisitButton() {
  const onHousePage = usePathname().startsWith("/casas/");
  return (
    <Button asChild variant={onHousePage ? "secondary" : "default"} className="ml-auto md:ml-0">
      <a href={sectionHref(landingSections.visit)}>Pedir visita</a>
    </Button>
  );
}
