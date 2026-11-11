import { ImageResponse } from "next/og";

import { OgMark, ogColors as c } from "./_lib/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** The logo's mark on white for the home screen, drawn from the same paths as the logo. */
export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: c.surface,
      }}
    >
      <OgMark color={c.ink} width={128} strokeWidth={2.6} />
    </div>,
    size,
  );
}
