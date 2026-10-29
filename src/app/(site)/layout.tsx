import { SkipLink } from "@/components/ui/skip-link";

import { SiteFooter } from "./_components/SiteFooter";
import { SiteHeader } from "./_components/SiteHeader";
import { SmoothScroll } from "./_components/SmoothScroll";

export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <SkipLink href="#contenido">Saltar al contenido</SkipLink>
      <SiteHeader />
      <main
        id="contenido"
        tabIndex={-1}
        className="flex flex-1 flex-col gap-16 pb-16 outline-none md:gap-28 md:pb-28"
      >
        {children}
      </main>
      <SiteFooter />
      <SmoothScroll />
    </>
  );
}
