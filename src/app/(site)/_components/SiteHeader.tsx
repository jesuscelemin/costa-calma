import { houseTypePath, listHouseTypes } from "@/features/houses/catalog";

import { cn } from "@/lib/utils";

import { overMediaText } from "../_lib/header-over-media";
import { headerNavigation } from "../_lib/sections";

import { HeaderShell } from "./HeaderShell";
import { HeaderVisitButton } from "./HeaderVisitButton";
import { HomeLink } from "./HomeLink";
import { MobileMenu } from "./MobileMenu";
import { ThemeToggle } from "./ThemeToggle";

export async function SiteHeader() {
  const houseTypes = await listHouseTypes();
  return (
    <HeaderShell>
      <div className="mx-auto flex h-(--header-height) max-w-7xl items-center gap-2 px-6 md:gap-6 md:px-10">
        <HomeLink />
        <nav aria-label="Principal" className="ml-auto hidden md:block">
          <ul className="flex gap-1">
            {headerNavigation.map(({ label, href }) => (
              <li key={href}>
                <a
                  href={href}
                  className={cn(
                    "inline-flex h-11 items-center rounded-full px-4 type-small font-medium text-ink underline-offset-[0.3em] focus-ring transition-colors hover:underline",
                    overMediaText,
                  )}
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <ThemeToggle className="hidden md:inline-flex" />
        <HeaderVisitButton housePaths={houseTypes.map(({ slug }) => houseTypePath(slug))} />
        <MobileMenu />
      </div>
    </HeaderShell>
  );
}
