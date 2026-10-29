// Copy of the flight's chapters, joined to the manifest by chapter id: new videos never touch the
// copy, nor the other way round. Draft from spec #10, for Jesús to edit.

export type ChapterCopy = {
  /** Short name of the chapter, shown with its counter ("01 / 03 · El mar"). */
  label: string;
  /** The title ends on its accent words, set in Fraunces italic. */
  title: { lead: string; accent: string };
  text: string;
};

export const flightChapterCopy: Record<string, ChapterCopy> = {
  sea: {
    label: "El mar",
    title: { lead: "Llegar", accent: "sin prisa" },
    text: "Doce viviendas de obra nueva frente a una cala tranquila del Mediterráneo.",
  },
  beach: {
    label: "La playa",
    title: { lead: "A cien pasos de la", accent: "arena" },
    text: "La playa empieza donde acaba tu calle.",
  },
  development: {
    label: "La urbanización",
    title: { lead: "Tu casa,", accent: "frente al mar" },
    text: "Villa Mar, Casa Pinar y Casa Duna: elige la tuya.",
  },
};
