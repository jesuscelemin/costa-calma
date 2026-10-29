import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { notFound } from "next/navigation";
import { ImageResponse } from "next/og";

import { availabilityLabel, getHouseType } from "@/features/houses/catalog";
import { formatPrice } from "@/lib/format";

export const alt = "Casa de Costa Calma con su nombre y su precio desde";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Static TTFs of the brand fonts (OFL): next/font serves WOFF2, which the image renderer cannot read.
const font = (file: string) =>
  readFile(join(process.cwd(), "src/app/(site)/casas/[slug]/_fonts", file));

/** Noche colors: the image is shared on any background, so it carries its own dark panel. */
const colors = {
  surface: "#121B1C",
  ink: "#F2ECE1",
  muted: "#A9B4B2",
  accent: "#EBA27E",
  sol: "#E9B45C",
};

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const houseType = await getHouseType((await params).slug);
  if (!houseType) notFound();
  const { title, kind, availability } = houseType;
  const offer =
    availability.priceFrom === null
      ? availabilityLabel(availability)
      : `Desde ${formatPrice(availability.priceFrom)}`;

  const [display, accent, ui] = await Promise.all([
    font("DarkerGrotesque-Regular.ttf"),
    font("Fraunces-Italic.ttf"),
    font("Manrope-SemiBold.ttf"),
  ]);

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
        background: `radial-gradient(circle at 78% 120%, rgba(233, 180, 92, 0.3), ${colors.surface} 60%)`,
        color: colors.ink,
        fontFamily: "Manrope",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 30 }}>
        {/* The logo's sun and waves, in one color like the brand mark. */}
        <svg
          width="72"
          height="56"
          viewBox="0 0 74 48"
          fill="none"
          stroke={colors.ink}
          strokeWidth="2.4"
          strokeLinecap="round"
        >
          <path d="M13.2 22.3 A23.6 23.6 0 1 1 59.3 28.8" />
          <path d="M1 29.5 C10 23 22 19.5 36 25 S62 32 72 24.5" />
          <path d="M7 36.3 C15 31 26 29 38 33 S59 39.5 67 33.3" />
          <path d="M13 43.6 C20 39 30 38 39 41.5 S55 47 61 42.7" />
        </svg>
        Costa Calma
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ fontSize: 30, color: colors.muted }}>{kind}</div>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 28,
            fontFamily: "Darker Grotesque",
            fontSize: 168,
            lineHeight: 0.9,
          }}
        >
          {title.lead}
          <span style={{ fontFamily: "Fraunces", fontSize: 134, color: colors.accent }}>
            {title.accent}
          </span>
        </div>
        <div style={{ fontSize: 40, marginTop: 16 }}>{offer}</div>
      </div>
    </div>,
    {
      ...size,
      fonts: [
        { name: "Darker Grotesque", data: display, weight: 400 },
        { name: "Fraunces", data: accent, style: "italic" },
        { name: "Manrope", data: ui, weight: 600 },
      ],
    },
  );
}
