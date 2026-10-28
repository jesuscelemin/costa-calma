import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";

import { landingSections, sectionHref } from "../_lib/sections";

import { HeaderShell } from "./HeaderShell";

const navigation = [
  { label: "Casas", href: sectionHref(landingSections.houseTypes) },
  { label: "Ubicación", href: sectionHref(landingSections.location) },
  { label: "Calidades", href: sectionHref(landingSections.qualities) },
  { label: "Mapa", href: sectionHref(landingSections.map) },
];

export function SiteHeader() {
  return (
    <HeaderShell>
      <div className="mx-auto flex h-(--header-height) max-w-7xl items-center gap-6 px-4 md:px-10">
        {/* The logo sits on its own surface-raised pill so it never lies directly on the hero. */}
        <Link href="/" className="rounded-full bg-surface-raised px-4 py-2 focus-ring">
          <Logo className="h-8" />
        </Link>
        <nav aria-label="Principal" className="ml-auto hidden md:block">
          <ul className="flex gap-1">
            {navigation.map(({ label, href }) => (
              <li key={href}>
                <a
                  href={href}
                  className="inline-flex h-11 items-center rounded-full px-4 type-small font-semibold text-ink focus-ring transition-colors hover:bg-mar-soft"
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <Button asChild className="ml-auto md:ml-0">
          <a href={sectionHref(landingSections.visit)}>Pedir visita</a>
        </Button>
      </div>
    </HeaderShell>
  );
}
