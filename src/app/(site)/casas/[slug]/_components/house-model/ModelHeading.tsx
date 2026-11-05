import { Accent } from "@/components/ui/accent";
import type { SheetHeading } from "@/features/houses/schema";

type ModelHeadingProps = { name: string; heading: SheetHeading };

/** The sheet's eyebrow, title and line, over the scene or over the corte without WebGL. */
export function ModelHeading({ name, heading: { lead, accent, line } }: ModelHeadingProps) {
  return (
    <div className="flex max-w-md flex-col gap-3">
      <p className="type-eyebrow text-ink-muted">Planta baja · {name}</p>
      <h2 id="maqueta-titulo" className="type-display-l text-ink">
        {lead} <Accent>{accent}</Accent>
      </h2>
      <p className="max-w-sm text-ink-muted max-md:type-small md:type-body">
        {line} Este plano es la casa: baja con el scroll y entra por la puerta.
      </p>
    </div>
  );
}
