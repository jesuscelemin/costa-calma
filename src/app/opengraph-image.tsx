import { ImageResponse } from "next/og";

import { OgMark, ogColors as c, ogFonts, ogSize } from "./_lib/og";

export const alt =
  "Costa Calma: vivir frente al Mediterráneo, sin prisa. El logo, un sol poniéndose tras tres olas, sobre un panel grafito.";
export const size = ogSize;
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background: c.surface,
        fontFamily: "Hanken Grotesk",
        color: c.ink,
      }}
    >
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <OgMark color={c.ink} width={56} />
          <span style={{ fontFamily: "Bodoni Moda", fontSize: 34 }}>Costa Calma</span>
        </div>
        <div style={{ fontFamily: "Bodoni Moda", fontSize: 76, lineHeight: 1 }}>
          Vivir frente al Mediterráneo, sin prisa.
        </div>
        <div style={{ fontSize: 24, color: c.muted }}>Viviendas de obra nueva junto a la playa</div>
      </div>
      <div
        style={{
          width: 440,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: c.graphite,
        }}
      >
        <OgMark color={c.onGraphite} width={220} />
      </div>
    </div>,
    { ...size, fonts: await ogFonts() },
  );
}
