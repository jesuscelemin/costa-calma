import type { SheetHeading } from "@/features/houses/schema";

type ModelHeadingProps = { name: string; heading: SheetHeading };

/** The walk's stages, from the sheet to the door. */
const steps = ["El plano", "Crecen los muros", "La maqueta", "Entrar por la puerta"];

/** The sheet's eyebrow, title and line, over the scene or over the corte without WebGL. */
export function ModelHeading({ name, heading: { lead, accent, line } }: ModelHeadingProps) {
  return (
    <div className="flex max-w-md flex-col gap-3">
      <p className="type-eyebrow text-ink-muted">Planta baja · {name}</p>
      <h2 id="maqueta-titulo" className="type-display-l text-ink">
        {lead} {accent}
      </h2>
      <p className="max-w-sm text-ink-muted max-md:type-small md:type-body">
        {line} Este plano es la casa: baja con el scroll y entra por la puerta.
      </p>
      {/* What the scroll does, in order (ADR 0010). */}
      <ol className="mt-2 hidden flex-col gap-1 type-small text-ink-muted md:flex">
        {steps.map((step, index) => (
          <li key={step} className="flex gap-3">
            <span className="w-5 tabular-nums">{index + 1}</span>
            {step}
          </li>
        ))}
      </ol>
    </div>
  );
}
