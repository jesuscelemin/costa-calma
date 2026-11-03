import { cn } from "@/lib/utils";

type FloorButtonsProps = {
  floors: { id: string; name: string }[];
  /** The floor shown, if any: its button is pressed. */
  current: string | null;
  onPick: (id: string) => void;
  label: string;
  className?: string;
};

/** Real buttons to pick a floor, as chips: on phones they scroll sideways. */
export function FloorButtons({ floors, current, onPick, label, className }: FloorButtonsProps) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "-mx-6 flex gap-2 overflow-x-auto px-6 md:mx-0 md:flex-wrap md:overflow-visible md:px-0",
        className,
      )}
    >
      {floors.map(({ id, name }) => (
        <button
          key={id}
          type="button"
          aria-pressed={id === current}
          onClick={() => onPick(id)}
          className={cn(
            "h-11 shrink-0 cursor-pointer rounded-full border px-5 type-small font-semibold whitespace-nowrap focus-ring transition-colors motion-reduce:transition-none",
            id === current
              ? "border-mar bg-mar-soft text-ink"
              : "border-line bg-surface-raised text-ink hover:bg-terracota-soft",
          )}
        >
          {name}
        </button>
      ))}
    </div>
  );
}
