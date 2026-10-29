import { Logo } from "@/components/ui/logo";

/** Times the name repeats in each half of the track: enough to outrun a wide screen at 240 px. */
const repeats = 3;

function MarqueeHalf() {
  return Array.from({ length: repeats }, (_, index) => (
    // On the baseline and nudged down, the mark's middle lines up with the middle of the capitals.
    <span key={index} className="flex items-baseline gap-[0.25em] pr-[0.25em]">
      Costa Calma
      <Logo variant="mark" className="size-[0.75em] shrink-0 translate-y-[0.1em]" />
    </span>
  ));
}

/**
 * Endless "Costa Calma ☀" closing the footer, after the macnaa reference: the name drifts to the
 * right with the logo's mark between repeats. As the block scrolls into view the name rises into
 * place from below, then a warm sun glow rises behind it (marquee-rise and sun-glow in
 * globals.css). The track holds the same half twice
 * and slides by one half, so the loop has no seam. Decorative, so hidden from assistive
 * technology, and still with reduced motion.
 */
export function FooterMarquee() {
  return (
    <div
      aria-hidden
      data-marquee
      className="relative mt-16 overflow-clip border-t border-line pt-40 pb-6 type-display-xl text-ink select-none [view-timeline-name:--footer-marquee] md:mt-28 md:pt-64 md:pb-10"
    >
      <div data-sun-glow className="absolute inset-x-[-5%] top-[30%] bottom-0 sun-glow" />
      <div data-marquee-rise className="relative marquee-rise">
        <div
          data-marquee-track
          className="flex w-max animate-marquee whitespace-nowrap motion-reduce:animate-none"
        >
          <MarqueeHalf />
          <MarqueeHalf />
        </div>
      </div>
    </div>
  );
}
