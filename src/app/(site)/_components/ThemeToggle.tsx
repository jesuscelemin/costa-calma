"use client";

import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ThemeToggleProps = {
  /** Show the action as text next to the icon (mobile menu) instead of an icon-only button. */
  withLabel?: boolean;
  className?: string;
};

/**
 * Switches between Día and Noche. The icon and the accessible name follow the `dark` variant in
 * CSS, so they are right from the first paint, before next-themes knows the resolved theme.
 */
export function ThemeToggle({ withLabel = false, className }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const labelClass = withLabel ? undefined : "sr-only";

  return (
    <Button
      type="button"
      // Icon-only it sits in the header, possibly over the hero, so it gets a surface of its own.
      variant={withLabel ? "ghost" : "secondary"}
      size={withLabel ? "default" : "icon"}
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className={className}
    >
      <span className="contents dark:hidden">
        <MoonIcon aria-hidden className={cn(withLabel && "size-5")} />
        <span className={labelClass}>Cambiar a modo Noche</span>
      </span>
      <span className="hidden dark:contents">
        <SunIcon aria-hidden className={cn(withLabel && "size-5")} />
        <span className={labelClass}>Cambiar a modo Día</span>
      </span>
    </Button>
  );
}
