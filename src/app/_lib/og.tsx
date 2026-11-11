import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Shared by the Open Graph images (ADR 0014): the shared size, the brand's colours as the image
// renderer needs them (plain hex, no CSS variables) and its fonts as static TTFs (OFL): next/font
// serves WOFF2, which the renderer cannot read.

export const ogSize = { width: 1200, height: 630 };

/** Día on the left, a Noche panel on the right: the image is shared on any background. */
export const ogColors = {
  surface: "#FFFFFF",
  ink: "#1C1C1C",
  muted: "#626467",
  line: "#E1E1DF",
  graphite: "#141516",
  onGraphite: "#EEEDEA",
  onGraphiteMuted: "#A3A5A8",
};

const font = (file: string) => readFile(join(process.cwd(), "src/app/_fonts", file));

/** Bodoni Moda for the display text and Hanken Grotesk for the rest. */
export async function ogFonts() {
  const [display, ui] = await Promise.all([
    font("BodoniModa-Display.ttf"),
    font("HankenGrotesk-Medium.ttf"),
  ]);
  return [
    { name: "Bodoni Moda", data: display, weight: 400 as const },
    { name: "Hanken Grotesk", data: ui, weight: 500 as const },
  ];
}

/** The logo's sun and three waves, in one colour, at the brand's fine stroke. */
export function OgMark({
  color,
  width,
  strokeWidth = 1.6,
}: {
  color: string;
  width: number;
  /** Thicker for a small icon, so the line holds. */
  strokeWidth?: number;
}) {
  return (
    <svg
      width={width}
      height={(width * 48) / 74}
      viewBox="0 0 74 48"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
    >
      <path d="M13.2 22.3 A23.6 23.6 0 1 1 59.3 28.8" />
      <path d="M1 29.5 C10 23 22 19.5 36 25 S62 32 72 24.5" />
      <path d="M7 36.3 C15 31 26 29 38 33 S59 39.5 67 33.3" />
      <path d="M13 43.6 C20 39 30 38 39 41.5 S55 47 61 42.7" />
    </svg>
  );
}
