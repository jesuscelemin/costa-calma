import { cn } from "@/lib/utils";

type FloorButtonsProps = {
  floors: { id: string; name: string }[];
  /** The floor shown, if any: its button is pressed. */
  current: string | null;
  onPick: (id: string) => void;
  label: string;
  /** On a phone, one row as wide as its box, each floor by its short name: «Baja», «Primera». */
  compact?: boolean;
  className?: string;
};

/**
 * A floor's name with «planta» apart, for a phone to leave it out: «Planta baja» reads «Baja»,
 * «Primera planta» «Primera». The name stays whole for readers and wider screens.
 */
function FloorName({ name }: { name: string }) {
  const match = /\s*planta\s*/i.exec(name);
  if (!match || match[0].length === name.length) return name;
  const [before, after] = [name.slice(0, match.index), name.slice(match.index + match[0].length)];
  return (
    <span className="max-md:capitalize">
      {before}
      <span className="max-md:hidden">{match[0]}</span>
      {after}
    </span>
  );
}

/** Real buttons to pick a floor, as chips: on phones they scroll sideways. */
export function FloorButtons({
  floors,
  current,
  onPick,
  label,
  compact,
  className,
}: FloorButtonsProps) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        compact
          ? "grid gap-1.5 md:flex md:flex-wrap md:gap-2"
          : "-mx-6 flex gap-2 overflow-x-auto px-6 md:mx-0 md:flex-wrap md:overflow-visible md:px-0",
        className,
      )}
      style={
        compact ? { gridTemplateColumns: `repeat(${floors.length}, minmax(0, 1fr))` } : undefined
      }
    >
      {floors.map(({ id, name }) => (
        <button
          key={id}
          type="button"
          aria-pressed={id === current}
          aria-label={compact ? name : undefined}
          onClick={() => onPick(id)}
          className={cn(
            "h-11 shrink-0 cursor-pointer rounded-full border px-5 type-small font-semibold whitespace-nowrap focus-ring transition-colors motion-reduce:transition-none",
            compact && "max-md:min-w-0 max-md:px-1",
            id === current
              ? "border-mar bg-mar-soft text-ink"
              : "border-line bg-surface-raised text-ink hover:bg-accion-soft",
          )}
        >
          {compact ? <FloorName name={name} /> : name}
        </button>
      ))}
    </div>
  );
}
