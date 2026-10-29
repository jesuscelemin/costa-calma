import { Accent } from "@/components/ui/accent";

import { SectionPlaceholder } from "../_components/SectionPlaceholder";
import { landingSections } from "../_lib/sections";

export default function LandingPage() {
  return (
    <>
      <section
        id={landingSections.hero}
        aria-labelledby="hero-title"
        data-header-overlay
        // The header adds the same inset (pt-2 md:pt-4) while it sits over this frame.
        className="h-svh p-2 md:p-4"
      >
        <div className="flex h-full flex-col justify-end gap-4 rounded-hero bg-arena p-6 md:p-16">
          <p className="type-eyebrow text-ink-muted">Obra nueva junto al Mediterráneo</p>
          <h1 id="hero-title" className="type-display-xl text-ink">
            Costa Calma
          </h1>
          <p className="max-w-3xl type-statement text-ink">
            Vivir frente al Mediterráneo, <Accent>sin prisa</Accent>.
          </p>
        </div>
      </section>
      <SectionPlaceholder
        id={landingSections.flight}
        eyebrow="Llegada"
        title="Vuelo"
        className="min-h-[150svh]"
      />
      <SectionPlaceholder
        id={landingSections.houseTypes}
        eyebrow="Tipologías"
        title="Tipologías"
        className="min-h-[80svh]"
      />
      <SectionPlaceholder
        id={landingSections.location}
        eyebrow="Ubicación"
        title="Ubicación"
        className="min-h-[70svh]"
      />
      <SectionPlaceholder
        id={landingSections.qualities}
        eyebrow="Calidades"
        title="Calidades"
        className="min-h-[70svh]"
      />
      <SectionPlaceholder
        id={landingSections.map}
        eyebrow="Disponibilidad"
        title="Mapa"
        className="min-h-svh"
      />
      <SectionPlaceholder
        id={landingSections.visit}
        eyebrow="Contacto"
        title="Visita"
        className="min-h-[70svh]"
      />
    </>
  );
}
