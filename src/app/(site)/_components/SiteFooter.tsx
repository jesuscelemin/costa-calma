import { Accent } from "@/components/ui/accent";
import { Logo } from "@/components/ui/logo";
import { RevealText } from "@/components/ui/reveal-text";

import { headerNavigation, landingSections, sectionHref } from "../_lib/sections";

const footerNavigation = [
  ...headerNavigation,
  { label: "Visita", href: sectionHref(landingSections.visit) },
];

const portfolioLinks = [
  { label: "GitHub de Jesús Celemín", href: "https://github.com/jesuscelemin" },
  { label: "Código del proyecto", href: "https://github.com/jesuscelemin/costa-calma" },
];

const linkClass =
  "inline-flex min-h-11 items-center rounded-full type-small font-semibold text-ink focus-ring transition-colors hover:text-mar";

/** Brand footer. Costa Calma is fictional, so the contact details are too. */
export function SiteFooter() {
  return (
    <footer className="bg-surface-sunken">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-16 md:grid-cols-[2fr_1fr_1fr] md:px-10 md:py-28">
        <div className="flex flex-col items-start gap-6">
          <Logo className="h-10" />
          <RevealText as="p" className="max-w-xl type-statement text-ink">
            <span className="text-ink-muted">Doce viviendas junto a la playa.</span> Vivir frente al
            Mediterráneo, <Accent>sin prisa</Accent>.
          </RevealText>
        </div>
        <nav aria-label="Secciones">
          <h2 className="type-eyebrow text-ink-muted">Explorar</h2>
          <ul className="mt-4 flex flex-col">
            {footerNavigation.map(({ label, href }) => (
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
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-6 md:flex-row md:items-center md:justify-between md:px-10">
          <p className="type-small text-ink-muted">
            Proyecto de portfolio de Jesús Celemín. Costa Calma es una promotora ficticia.
          </p>
          <ul className="flex flex-wrap gap-x-6">
            {portfolioLinks.map(({ label, href }) => (
              <li key={href}>
                <a href={href} className={linkClass}>
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
