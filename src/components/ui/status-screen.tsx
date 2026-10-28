import { cn } from "@/lib/utils";

type StatusScreenProps = {
  eyebrow: string;
  title: string;
  message: string;
  /** Buttons or links; keep a single primary (mar) action. */
  children: React.ReactNode;
  className?: string;
};

/** Full-height brand message for 404 and error pages. */
export function StatusScreen({ eyebrow, title, message, children, className }: StatusScreenProps) {
  return (
    <section
      className={cn(
        "mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-6 px-6 py-16 md:px-10 md:py-28",
        className,
      )}
    >
      <p className="type-eyebrow text-terracota-text">{eyebrow}</p>
      <h1 className="type-display-l text-ink">{title}</h1>
      <p className="max-w-xl type-body text-ink-muted">{message}</p>
      <div className="mt-4 flex flex-wrap gap-4">{children}</div>
    </section>
  );
}
