"use client";

import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";

import { cn } from "@/lib/utils";

import { overMediaPrimary, overMediaQuiet } from "../_lib/header-over-media";
import { landingSections, sectionHref } from "../_lib/sections";

type HeaderVisitButtonProps = {
  /** The house pages, whose presentation has its own primary "Pedir visita". */
  housePaths: string[];
};

/**
 * The header's "Pedir visita". It is the view's single primary button, except on a house page:
 * there the header's steps back to secondary. Only on real ones: an unknown house's 404 keeps it.
 */
export function HeaderVisitButton({ housePaths }: HeaderVisitButtonProps) {
  const onHousePage = housePaths.includes(usePathname());
  return (
    <Button
      asChild
      variant={onHousePage ? "secondary" : "default"}
      className={cn("ml-auto md:ml-0", onHousePage ? overMediaQuiet : overMediaPrimary)}
    >
      <a href={sectionHref(landingSections.visit)}>Pedir visita</a>
    </Button>
  );
}
