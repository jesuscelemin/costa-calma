import { RevealText } from "@/components/ui/reveal-text";
import { cn } from "@/lib/utils";

type SectionPlaceholderProps = {
  id: string;
  eyebrow: string;
  title: string;
  /** Approximate final height, so anchors and the header behave as they will. */
  className?: string;
};

/** Stand-in for a landing section that a later phase will build. */
export function SectionPlaceholder({ id, eyebrow, title, className }: SectionPlaceholderProps) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="px-4 md:px-10">
      <div
        className={cn(
          "mx-auto flex max-w-7xl flex-col justify-end gap-2 rounded-card bg-arena p-6 md:p-10",
          className,
        )}
      >
        <p className="type-eyebrow text-ink-muted">{eyebrow}</p>
        <RevealText as="h2" id={`${id}-title`} className="type-display-l text-ink">
          {title}
        </RevealText>
      </div>
    </section>
  );
}
