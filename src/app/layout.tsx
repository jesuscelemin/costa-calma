import type { Metadata } from "next";
import { Fraunces, Manrope } from "next/font/google";
import "@/styles/globals.css";

import { ThemeProvider } from "./_components/ThemeProvider";

const fraunces = Fraunces({
  subsets: ["latin"],
  axes: ["opsz"],
  variable: "--font-fraunces",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

const title = "Calma Costa · Viviendas de obra nueva junto al Mediterráneo";
const description =
  "Vivir frente al Mediterráneo, sin prisa. Viviendas de obra nueva en una pequeña urbanización junto a la playa.";

export const metadata: Metadata = {
  title,
  description,
  openGraph: {
    type: "website",
    locale: "es_ES",
    siteName: "Calma Costa",
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
      className={`${fraunces.variable} ${manrope.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
