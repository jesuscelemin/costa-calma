import { Accent } from "@/components/ui/accent";
import { ArtDirectedImage } from "@/components/ui/art-directed-image";
import { RevealText } from "@/components/ui/reveal-text";
import { FlightSection } from "@/features/flight/components/FlightSection";
import { flightManifest } from "@/features/flight/manifest";

import { SectionPlaceholder } from "../_components/SectionPlaceholder";
import { landingSections } from "../_lib/sections";

const { sources } = flightManifest;

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
        <div className="@container relative isolate flex h-full flex-col justify-end overflow-hidden rounded-hero bg-arena">
          {/* The flight starts from this same frame, so the hero leads straight into it. */}
          <ArtDirectedImage
            desktop={sources.desktop.poster}
            mobile={sources.mobile.poster}
            eager
            className="-z-10"
          />
          <div aria-hidden className="absolute inset-0 -z-10 bg-scrim" />
          {/*
            Decorative brand name, translucent over the image (#16). display-xl, sized to span the
            frame: "Costa Calma" is about 4.3 em wide in Darker Grotesque.
          */}
          <p
            aria-hidden
            className="absolute inset-x-0 top-[calc(var(--header-height)+2rem)] text-center type-display-xl text-[21cqw] whitespace-nowrap on-media opacity-60 md:top-[calc(var(--header-height)+3rem)]"
          >
            Costa Calma
          </p>
          {/* The scrim's text zone is the bottom 40 %: the text stays inside it. */}
          <div className="flex max-h-[40%] flex-col justify-end gap-4 p-6 on-media md:p-16">
            <p className="type-eyebrow">Obra nueva junto al Mediterráneo</p>
            <RevealText as="h1" id="hero-title" className="max-w-4xl type-display-l text-balance">
              {/* The accent stays on one line: "sin / prisa" would break the motto's rhythm. */}
              Vivir frente al Mediterráneo, <Accent className="whitespace-nowrap">sin prisa</Accent>
              .
            </RevealText>
          </div>
        </div>
      </section>
      <FlightSection id={landingSections.flight} skipTo={landingSections.houseTypes} />
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
