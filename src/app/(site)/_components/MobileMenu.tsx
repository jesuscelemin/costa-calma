import { MenuIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

import { headerNavigation } from "../_lib/sections";

import { HomeLink } from "./HomeLink";
import { ThemeToggle } from "./ThemeToggle";

/**
 * Full-screen menu for small screens. Radix traps focus, closes on Esc, on the close button or
 * when a link is chosen, and returns focus to the menu button.
 */
export function MobileMenu() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="secondary" size="icon" className="md:hidden">
          <MenuIcon className="size-6" aria-hidden />
          <span className="sr-only">Abrir menú</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="full" showCloseButton={false} aria-describedby={undefined}>
        {/* Same row as the site header, so the close button lands where the menu button was. */}
        <div className="flex h-(--header-height) items-center gap-2 px-6">
          <SheetClose asChild>
            <HomeLink />
          </SheetClose>
          <SheetTitle className="sr-only">Menú</SheetTitle>
          <SheetClose asChild>
            <Button variant="ghost" size="icon" className="ml-auto">
              <XIcon className="size-6" aria-hidden />
              <span className="sr-only">Cerrar menú</span>
            </Button>
          </SheetClose>
        </div>
        <nav aria-label="Principal" className="flex-1 overflow-y-auto px-6 pt-10">
          <ul className="flex flex-col gap-2">
            {headerNavigation.map(({ label, href }) => (
              <li key={href}>
                <SheetClose asChild>
                  <a
                    href={href}
                    className="-mx-2 inline-flex min-h-16 items-center rounded-card px-2 type-display-l text-ink focus-ring"
                  >
                    {label}
                  </a>
                </SheetClose>
              </li>
            ))}
          </ul>
        </nav>
        <div className="border-t border-line px-6 py-6">
          <ThemeToggle withLabel className="-ml-4" />
        </div>
      </SheetContent>
    </Sheet>
  );
}
