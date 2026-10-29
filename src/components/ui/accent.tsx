import { cn } from "@/lib/utils";

type AccentProps = {
  children: React.ReactNode;
  className?: string;
};

/** Accent word of a title, in Fraunces italic and terracota-text, or on-media-accent over media (ADR 0002). */
export function Accent({ children, className }: AccentProps) {
  return <em className={cn("type-accent", className)}>{children}</em>;
}
