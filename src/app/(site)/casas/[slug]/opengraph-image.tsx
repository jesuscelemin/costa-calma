import { notFound } from "next/navigation";
import { ImageResponse } from "next/og";

import { OgMark, ogColors as c, ogFonts, ogSize } from "@/app/_lib/og";
import { getHouseType, offerLabel } from "@/features/houses/catalog";

export const alt = "Casa de Costa Calma con su nombre y su precio desde";
export const size = ogSize;
export const contentType = "image/png";

/** The house's name large in Bodoni on a graphite panel, with its kind and offer (ADR 0014). */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const houseType = await getHouseType((await params).slug);
  if (!houseType) notFound();
  const { name, kind, availability } = houseType;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
        background: c.graphite,
        color: c.onGraphite,
        fontFamily: "Hanken Grotesk",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <OgMark color={c.onGraphite} width={56} />
        <span style={{ fontFamily: "Bodoni Moda", fontSize: 34 }}>Costa Calma</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ fontSize: 28, color: c.onGraphiteMuted }}>{kind}</div>
        <div style={{ fontFamily: "Bodoni Moda", fontSize: 120, lineHeight: 0.95 }}>{name}</div>
        <div
          style={{
            display: "flex",
            marginTop: 16,
            paddingTop: 24,
            borderTop: `1px solid ${c.onGraphiteMuted}`,
            fontSize: 36,
          }}
        >
          {offerLabel(availability)}
        </div>
      </div>
    </div>,
    { ...size, fonts: await ogFonts() },
  );
}
