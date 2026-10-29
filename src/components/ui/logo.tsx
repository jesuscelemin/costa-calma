import { cn } from "@/lib/utils";

import { wordmarkPath } from "./logo-wordmark";

const variants = {
  horizontal: { viewBox: "0 0 332 96", symbolOffset: "translate(8 23)", size: "h-10 w-auto" },
  mark: { viewBox: "0 0 88 88", symbolOffset: "translate(8 20)", size: "h-10 w-10" },
} as const;

type LogoProps = {
  /** `horizontal`: symbol and name, for header and footer. `mark`: symbol only. */
  variant?: keyof typeof variants;
  className?: string;
};

/**
 * Costa Calma logo: a line-drawn sun setting behind three waves, redrawn from Jesús's 2026-10-29
 * artwork, with the outlined wordmark. All in one color, ink: light in Noche, dark in Día. Each part carries `data-part` so the
 * loading animation can move the sun and the waves independently. The horizontal viewBox is
 * trimmed to the end of the wordmark.
 */
export function Logo({ variant = "horizontal", className }: LogoProps) {
  const { viewBox, symbolOffset, size } = variants[variant];

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={viewBox}
      role="img"
      aria-label="Costa Calma"
      data-slot="logo"
      className={cn(size, className)}
    >
      <g
        transform={symbolOffset}
        fill="none"
        strokeWidth={2.4}
        strokeLinecap="round"
        className="stroke-ink"
      >
        <path data-part="sun" d="M13.2 22.3 A23.6 23.6 0 1 1 59.3 28.8" />
        <path data-part="wave" d="M1 29.5 C10 23 22 19.5 36 25 S62 32 72 24.5" />
        <path data-part="wave" d="M7 36.3 C15 31 26 29 38 33 S59 39.5 67 33.3" />
        <path data-part="wave" d="M13 43.6 C20 39 30 38 39 41.5 S55 47 61 42.7" />
      </g>
      {variant === "horizontal" && <path data-part="name" d={wordmarkPath} className="fill-ink" />}
    </svg>
  );
}
