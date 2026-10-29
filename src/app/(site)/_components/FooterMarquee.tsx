/** Times the name repeats in each half of the track: enough to outrun a wide screen at 240 px. */
const repeats = 3;

/** The logo's half sun, resting on the baseline like the sun on the horizon. */
function Sun() {
  return (
    <svg viewBox="8 16 56 28" className="h-[0.35em] w-[0.7em] shrink-0 fill-sol">
      <path d="M8 44 A28 28 0 0 1 64 44 Z" />
    </svg>
  );
}

function MarqueeHalf() {
  return Array.from({ length: repeats }, (_, index) => (
    <span key={index} className="flex items-baseline gap-[0.2em] pr-[0.2em]">
      Costa Calma
      <Sun />
    </span>
  ));
}

/**
 * Endless "Costa Calma ☀" closing the footer, over a warm sol glow. The track holds the same
 * half twice and slides by one half, so the loop has no seam. Decorative, so hidden from
 * assistive technology, and still with reduced motion.
 */
export function FooterMarquee() {
  return (
    <div
      aria-hidden
      data-marquee
      className="relative mt-16 overflow-hidden bg-sun-glow pt-10 pb-6 type-display-xl text-ink select-none md:mt-28 md:pt-16 md:pb-10"
    >
      <div className="flex w-max animate-marquee whitespace-nowrap motion-reduce:animate-none">
        <MarqueeHalf />
        <MarqueeHalf />
      </div>
    </div>
  );
}
