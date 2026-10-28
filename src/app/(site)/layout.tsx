import { SiteFooter } from "./_components/SiteFooter";
import { SiteHeader } from "./_components/SiteHeader";

export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <a
        href="#contenido"
        className="sr-only rounded-full bg-surface-raised px-6 py-3 font-semibold text-ink focus-ring focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-60"
      >
        Saltar al contenido
      </a>
      <SiteHeader />
      <main
        id="contenido"
        tabIndex={-1}
        className="flex flex-1 flex-col gap-16 pb-16 outline-none md:gap-28 md:pb-28"
      >
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
