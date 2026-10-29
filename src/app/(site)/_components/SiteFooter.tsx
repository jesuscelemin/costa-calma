import { Accent } from "@/components/ui/accent";
import { Logo } from "@/components/ui/logo";
import { RevealText } from "@/components/ui/reveal-text";

import { headerNavigation } from "../_lib/sections";
import { FooterMarquee } from "./FooterMarquee";

const portfolioLinks = [
  { label: "GitHub", href: "https://github.com/jesuscelemin" },
  { label: "Código del proyecto", href: "https://github.com/jesuscelemin/costa-calma" },
];

const linkClass =
  "inline-flex min-h-11 items-center rounded-full type-small font-semibold text-ink focus-ring transition-colors hover:text-mar";

/**
 * Brand footer, after the macnaa reference: the statement on the left, the details in small text
 * on the right with the portfolio links set as large as the statement and underlined, and a
 * marquee of the brand over a rising sun glow to close the page. Costa Calma is fictional, so
 * the contact details are too.
 */
export function SiteFooter() {
  return (
    <footer className="bg-surface-sunken">
      <div className="mx-auto grid max-w-7xl gap-16 px-6 pt-16 md:grid-cols-2 md:gap-x-10 md:gap-y-20 md:px-10 md:pt-28">
        <div className="flex flex-col items-start gap-6">
          <Logo className="h-10" />
          <RevealText as="p" className="max-w-lg type-statement text-ink">
            <span className="text-ink-muted">Doce viviendas junto a la playa.</span> Vivir frente al
            Mediterráneo, <Accent>sin prisa</Accent>.
          </RevealText>
        </div>

        <div className="grid gap-10 sm:grid-cols-2">
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
        </div>

        <ul className="flex flex-wrap gap-x-8 gap-y-2 md:self-end">
          {portfolioLinks.map(({ label, href }) => (
            <li key={href}>
              <a
                href={href}
                className="type-statement text-ink underline decoration-1 underline-offset-[0.16em] focus-ring transition-colors hover:text-mar hover:decoration-2"
              >
                {label}
              </a>
            </li>
          ))}
        </ul>

        {/* Bottom left on wide screens, beside the links; last on phones. */}
        <p className="max-w-sm self-end type-small text-ink-muted md:col-start-1 md:row-start-2">
          Proyecto de portfolio de Jesús Celemín. Costa Calma es una promotora ficticia.
        </p>
      </div>
      <FooterMarquee />
    </footer>
  );
}
