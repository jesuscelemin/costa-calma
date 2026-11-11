import { ArtDirectedImage } from "@/components/ui/art-directed-image";
import { RevealText } from "@/components/ui/reveal-text";
import { FlightSection } from "@/features/flight/components/FlightSection";
import { flightManifest } from "@/features/flight/manifest";

import { SectionPlaceholder } from "../_components/SectionPlaceholder";
import { landingSections } from "../_lib/sections";

import { HouseTypePicker } from "./_components/HouseTypePicker";
import { LandingPhrase } from "./_components/LandingPhrase";

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
        <div className="@container relative isolate flex h-full flex-col justify-end overflow-hidden bg-piedra">
          {/* The flight starts from this same frame, so the hero leads straight into it. */}
          <ArtDirectedImage
            desktop={sources.desktop.poster}
            mobile={sources.mobile.poster}
            eager
            className="-z-10"
          />
          <div aria-hidden className="absolute inset-0 -z-10 bg-scrim" />
          {/* Under the header, whose controls lie on the image in light text. */}
          <div aria-hidden className="absolute inset-x-0 top-0 -z-10 h-40 bg-scrim-top" />
          {/*
            Decorative brand name, translucent over the image (#16). display-xl, sized to span the
            frame: "Costa Calma" is about 5.3 em wide in Bodoni Moda, so 17cqw spans about 90 %.
            It retreats as the page scrolls into the flight (`[data-hero-wordmark]`, globals.css).
          */}
          <p
            aria-hidden
            data-hero-wordmark
            className="absolute inset-x-0 top-[calc(var(--header-height)+2rem)] text-center type-display-xl text-[17cqw] whitespace-nowrap on-media opacity-60 md:top-[calc(var(--header-height)+3rem)]"
          >
            Costa Calma
          </p>
          {/* The scrim's text zone is the bottom 40 %: the text stays inside it. */}
          <div className="flex max-h-[40%] flex-col justify-end gap-4 p-6 on-media md:p-16">
            <p className="type-eyebrow">Obra nueva junto al Mediterráneo</p>
            <RevealText as="h1" id="hero-title" className="max-w-4xl type-display-l text-balance">
              Vivir frente al Mediterráneo, sin prisa.
            </RevealText>
          </div>
        </div>
      </section>
      <FlightSection id={landingSections.flight} skipTo={landingSections.houseTypes} />
      <LandingPhrase />
      <HouseTypePicker id={landingSections.houseTypes} />
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
