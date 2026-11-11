import type { Metadata } from "next";
import { Bodoni_Moda, Hanken_Grotesk } from "next/font/google";
import "@/styles/globals.css";

import { ThemeProvider } from "./_components/ThemeProvider";

// Display type (ADR 0014): titles, statements and figures, with optical sizes.
const bodoniModa = Bodoni_Moda({
  subsets: ["latin"],
  axes: ["opsz"],
  variable: "--font-bodoni-moda",
  display: "swap",
});

// Interface and running text.
const hankenGrotesk = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken-grotesk",
  display: "swap",
});

const title = "Costa Calma · Viviendas de obra nueva junto al Mediterráneo";
const description =
  "Vivir frente al Mediterráneo, sin prisa. Viviendas de obra nueva en una pequeña urbanización junto a la playa.";

export const metadata: Metadata = {
  title: { default: title, template: "%s · Costa Calma" },
  description,
  openGraph: {
    type: "website",
    locale: "es_ES",
    siteName: "Costa Calma",
    title,
    description,
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // next-themes writes data-theme and color-scheme on <html> before hydration.
    <html
      lang="es"
      className={`${bodoniModa.variable} ${hankenGrotesk.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
