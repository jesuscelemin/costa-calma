import { ArrowUpRightIcon } from "lucide-react";

import { Accent } from "@/components/ui/accent";
import { Logo } from "@/components/ui/logo";
import { RevealText } from "@/components/ui/reveal-text";

import { headerNavigation, landingSections, sectionHref } from "../_lib/sections";
import { FooterMarquee } from "./FooterMarquee";

const largeLinks = [
  { label: "Pedir visita", href: sectionHref(landingSections.visit) },
  { label: "GitHub", href: "https://github.com/jesuscelemin" },
  { label: "Código del proyecto", href: "https://github.com/jesuscelemin/costa-calma" },
];

const linkClass =
  "inline-flex min-h-11 items-center rounded-full type-small font-semibold text-ink focus-ring transition-colors hover:text-mar";

/**
 * Brand footer, after the macnaa reference: oversized underlined links, the details in small
 * text and a marquee of the brand to close the page. Costa Calma is fictional, so the contact
 * details are too.
 */
export function SiteFooter() {
  return (
    <footer className="bg-surface-sunken">
      <div className="mx-auto flex max-w-7xl flex-col gap-16 px-6 pt-16 md:gap-28 md:px-10 md:pt-28">
        <div className="flex flex-col items-start gap-6">
          <Logo className="h-10" />
          <RevealText as="p" className="max-w-xl type-statement text-ink">
            <span className="text-ink-muted">Doce viviendas junto a la playa.</span> Vivir frente al
            Mediterráneo, <Accent>sin prisa</Accent>.
          </RevealText>
        </div>

        <ul className="flex flex-col border-t border-line">
          {largeLinks.map(({ label, href }) => (
            <li key={href} className="border-b border-line">
              <a
                href={href}
                className="group flex items-center justify-between gap-6 rounded-card py-4 type-display-l text-ink focus-ring transition-colors hover:text-mar md:py-6"
              >
                <span
                  data-underline
                  className="underline decoration-1 underline-offset-[0.14em] group-hover:decoration-2"
                >
                  {label}
                </span>
                {/* Links that leave the site carry an arrow. */}
                {href.startsWith("https://") && (
                  <ArrowUpRightIcon
                    aria-hidden
                    strokeWidth={1.25}
                    className="size-[0.6em] shrink-0 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1 motion-reduce:transition-none"
                  />
                )}
              </a>
            </li>
          ))}
        </ul>

        <div className="grid gap-10 sm:grid-cols-2 md:grid-cols-[1fr_1fr_2fr]">
          <nav aria-label="Secciones">
            <h2 className="type-eyebrow text-ink-muted">Explorar</h2>
            <ul className="mt-4 flex flex-col">
              {headerNavigation.map(({ label, href }) => (
                <li key={href}>
                  <a href={href} className={linkClass}>
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div>
            <h2 className="type-eyebrow text-ink-muted">Contacto</h2>
            <address className="mt-4 flex flex-col gap-2 type-small text-ink not-italic">
              <span>Paseo Marítimo, 1</span>
              <span>Costa Mediterránea</span>
              <span>+34 600 000 000</span>
              <span>hola@costacalma.example</span>
            </address>
          </div>
          <p className="max-w-sm type-small text-ink-muted sm:col-span-2 md:col-span-1 md:justify-self-end">
            Proyecto de portfolio de Jesús Celemín. Costa Calma es una promotora ficticia.
          </p>
        </div>
      </div>
      <FooterMarquee />
    </footer>
  );
}
