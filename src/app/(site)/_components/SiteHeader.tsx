import { Button } from "@/components/ui/button";

import { headerNavigation, landingSections, sectionHref } from "../_lib/sections";

import { HeaderShell } from "./HeaderShell";
import { HomeLink } from "./HomeLink";
import { MobileMenu } from "./MobileMenu";
import { ThemeToggle } from "./ThemeToggle";

export function SiteHeader() {
  return (
    <HeaderShell>
      <div className="mx-auto flex h-(--header-height) max-w-7xl items-center gap-2 px-6 md:gap-6 md:px-10">
        <HomeLink />
        <nav aria-label="Principal" className="ml-auto hidden md:block">
          {/* On its own pill, like the logo: over the hero and the flight it lies on media. */}
          <ul className="flex gap-1 rounded-full bg-surface-raised">
            {headerNavigation.map(({ label, href }) => (
              <li key={href}>
                <a
                  href={href}
                  className="inline-flex h-11 items-center rounded-full px-4 type-small font-semibold text-ink focus-ring transition-colors hover:bg-terracota-soft"
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <ThemeToggle className="hidden md:inline-flex" />
        <Button asChild className="ml-auto md:ml-0">
          <a href={sectionHref(landingSections.visit)}>Pedir visita</a>
        </Button>
        <MobileMenu />
      </div>
    </HeaderShell>
  );
}
