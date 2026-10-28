import { Logo } from "@/components/ui/logo";

import { SectionPlaceholder } from "./_components/SectionPlaceholder";

export default function LandingPage() {
  return (
    <>
      <section id="hero" aria-labelledby="hero-title" className="h-svh p-2 md:p-4">
        <div className="flex h-full flex-col justify-end gap-4 rounded-hero bg-arena p-6 md:p-16">
          <Logo className="mb-auto h-10 self-start md:h-12" />
          <p className="type-eyebrow text-ink-muted">Obra nueva junto al Mediterráneo</p>
          <h1 id="hero-title" className="type-display-xl text-ink">
            Calma Costa
          </h1>
          <p className="max-w-md type-title text-ink">Vivir frente al Mediterráneo, sin prisa.</p>
        </div>
      </section>
      <SectionPlaceholder id="vuelo" eyebrow="Llegada" title="Vuelo" className="min-h-[150svh]" />
      <SectionPlaceholder
        id="tipologias"
        eyebrow="Tipologías"
        title="Tipologías"
        className="min-h-[80svh]"
      />
      <SectionPlaceholder
        id="ubicacion"
        eyebrow="Ubicación"
        title="Ubicación"
        className="min-h-[70svh]"
      />
      <SectionPlaceholder
        id="calidades"
        eyebrow="Calidades"
        title="Calidades"
        className="min-h-[70svh]"
      />
      <SectionPlaceholder id="mapa" eyebrow="Disponibilidad" title="Mapa" className="min-h-svh" />
      <SectionPlaceholder id="visita" eyebrow="Contacto" title="Visita" className="min-h-[70svh]" />
    </>
  );
}
