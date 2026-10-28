import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Calma Costa · Viviendas de obra nueva junto al Mediterráneo",
  description:
    "Vivir frente al Mediterráneo, sin prisa. Viviendas de obra nueva en una pequeña urbanización junto a la playa.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
