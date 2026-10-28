"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Día/Noche theme. Follows the system until the visitor chooses, then remembers the choice in
 * localStorage. next-themes sets `data-theme` with an inline script before the first paint, so
 * the server never reads cookies and the page stays static.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="data-theme"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
