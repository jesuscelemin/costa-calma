import type { Metadata } from "next";
import { Darker_Grotesque, Fraunces, Manrope } from "next/font/google";
import "@/styles/globals.css";

import { ThemeProvider } from "./_components/ThemeProvider";

// Display type (ADR 0002): 300 for the largest sizes, 400 for titles, 500 for figures and cards.
const darkerGrotesque = Darker_Grotesque({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-darker-grotesque",
  display: "swap",
});

// Only the italic accent words: the logo wordmark is outlined to paths.
const fraunces = Fraunces({
  subsets: ["latin"],
  style: "italic",
  axes: ["opsz"],
  variable: "--font-fraunces",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
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
      className={`${darkerGrotesque.variable} ${fraunces.variable} ${manrope.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
