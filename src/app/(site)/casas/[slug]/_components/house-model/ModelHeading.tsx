import { Accent } from "@/components/ui/accent";

/** The sheet's eyebrow, title and line, over the scene or over the corte without WebGL. */
export function ModelHeading({ name }: { name: string }) {
  return (
    <div className="flex max-w-md flex-col gap-3">
      <p className="type-eyebrow text-ink-muted">Planta baja · {name}</p>
      <h2 id="maqueta-titulo" className="type-display-l text-ink">
        De la puerta al <Accent>mar</Accent>
      </h2>
      <p className="max-w-sm text-ink-muted max-md:type-small md:type-body">
        En línea recta, de la puerta norte a la piscina. Este plano es la casa: baja con el scroll y
        entra por la puerta.
      </p>
    </div>
  );
}
