// The house model's colours in Día and Noche while it is still a drawing: the corte's paper and
// ink, and the house behind it in the same paper, lined in ink. Every colour is a brand token
// (model-palette.test.ts checks them against tokens.css), so the 3D meets the SVG drawing.

export type ModelPalette = {
  /** The paper the corte is drawn on, behind everything: `surface`. */
  background: string;
  /** The house's faces behind the cut: `surface-raised`. */
  paper: string;
  /** Its edges: `ink`. */
  ink: string;
  /** The pool's water, as the drawing fills it: `mar-soft`. */
  water: string;
  /** How strong the even light and the sun are, to shade the faces without losing the paper. */
  intensity: { ambient: number; sun: number };
};

export const modelPalettes: Record<"light" | "dark", ModelPalette> = {
  light: {
    background: "#f6f1e8",
    paper: "#fffdf9",
    ink: "#1e2a2b",
    water: "#d7e8e9",
    intensity: { ambient: 2.4, sun: 0.9 },
  },
  dark: {
    background: "#121b1c",
    paper: "#1a2627",
    ink: "#f2ece1",
    water: "#1c3a3e",
    intensity: { ambient: 2.6, sun: 1.2 },
  },
};
