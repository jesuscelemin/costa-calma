// Copy of the flight's chapters, joined to the manifest by chapter id: new videos never touch the
// copy, nor the other way round. Galería blanca copy (ADR 0014), for Jesús to edit.

export type ChapterCopy = {
  /** Short name of the chapter, over its title. */
  label: string;
  title: string;
  text: string;
};

export const flightChapterCopy: Record<string, ChapterCopy> = {
  sea: {
    label: "El mar",
    title: "Doce casas junto al mar",
    text: "Obra nueva frente a una cala tranquila del Mediterráneo.",
  },
  beach: {
    label: "La playa",
    title: "A cien pasos de la arena",
    text: "La playa empieza donde acaba tu calle.",
  },
  development: {
    label: "La urbanización",
    title: "Villa Duna Blanca",
    text: "En primera línea, con Casa Pinar y Casa Olivo detrás. Elige la tuya.",
  },
};
