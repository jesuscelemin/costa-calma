import { cn } from "@/lib/utils";

import { wordmarkPath } from "./logo-wordmark";

const variants = {
  horizontal: { viewBox: "0 0 332 96", symbolOffset: "translate(8 12)", size: "h-10 w-auto" },
  mark: { viewBox: "0 0 88 88", symbolOffset: "translate(8 4)", size: "h-10 w-10" },
} as const;

type LogoProps = {
  /** `horizontal`: symbol and name, for header and footer. `mark`: symbol only. */
  variant?: keyof typeof variants;
  className?: string;
};

/**
 * Calma Costa logo, drawn from the official SVGs in the design system: half sun (sol) over two
 * waves (mar) and a line of land (terracota). Each part carries `data-part` so the loading
 * animation can move the sun, waves and land independently. The horizontal viewBox is trimmed
 * to the end of the wordmark (the official file leaves empty space up to 400).
 */
export function Logo({ variant = "horizontal", className }: LogoProps) {
  const { viewBox, symbolOffset, size } = variants[variant];

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={viewBox}
      role="img"
      aria-label="Calma Costa"
      data-slot="logo"
      className={cn(size, className)}
    >
      <g transform={symbolOffset}>
        <path data-part="sun" d="M8 44 A28 28 0 0 1 64 44 Z" className="fill-sol" />
        <g fill="none" strokeWidth={4} strokeLinecap="round">
          <path data-part="wave" d="M0 52 Q12 46 24 52 T48 52 T72 52" className="stroke-mar" />
          <path data-part="wave" d="M0 62 Q12 56 24 62 T48 62 T72 62" className="stroke-mar" />
          <path
            data-part="land"
            d="M10 72 Q20 67 31 72 T52 72 T64 72"
            className="stroke-terracota"
          />
        </g>
      </g>
      {variant === "horizontal" && <path data-part="name" d={wordmarkPath} className="fill-ink" />}
    </svg>
  );
}
