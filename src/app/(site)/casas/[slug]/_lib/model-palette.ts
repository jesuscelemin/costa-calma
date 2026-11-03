// The house model's colours and light in Día and Noche. While it is still a drawing it is the
// corte's paper and ink, and the house behind it in the same paper, lined in ink: every colour of
// the drawing is a brand token (model-palette.test.ts checks them against tokens.css), so the 3D
// meets the SVG drawing. The sweep then turns it into materials, made in code, under the theme's
// light: noon in Día, dusk in Noche with the house's lights on and the pool lit.

type Light = { color: string; intensity: number };

export type ModelPalette = {
  /** The paper the corte is drawn on, behind everything: `surface`. */
  background: string;
  /** The house's faces behind the cut: `surface-raised`. */
  paper: string;
  /** Its edges: `ink`. */
  ink: string;
  /** The pool's water, as the drawing fills it: `mar-soft`. */
  water: string;
  /** How strong the even light and the sun are on the paper, to shade its faces without losing it. */
  intensity: { ambient: number; sun: number };
  /** Once swept: the light the materials take. */
  scene: {
    /** The sky, from straight up to the horizon, that takes the paper's place. */
    sky: { top: string; horizon: string };
    /** The sun, where it stands over the house (x east, y up, z south, in metres). */
    sun: Light & { position: readonly [number, number, number] };
    /** The sky's and the ground's light on everything the sun leaves in shade. */
    fill: Light & { ground: string };
    /** Where the house is cut, once in colour. */
    cut: string;
    /** The sweep's leading edge, a thin line of light as it crosses the corte. */
    glow: string;
    /** The rooms' lights, through their glass; none by day. */
    rooms: Light | null;
    /** The pool's own light under the water; none by day. */
    pool: Light | null;
    /** How strong the ambient occlusion is, on desktop. */
    occlusion: number;
  };
};

export const modelPalettes: Record<"light" | "dark", ModelPalette> = {
  light: {
    background: "#f6f1e8",
    paper: "#fffdf9",
    ink: "#1e2a2b",
    water: "#d7e8e9",
    intensity: { ambient: 2.4, sun: 0.9 },
    scene: {
      sky: { top: "#a9cdd1", horizon: "#f3ede2" },
      // Midday in summer: high, a little west of south.
      sun: { color: "#fff6e8", intensity: 3.2, position: [-10, 42, 26] },
      fill: { color: "#e4eff0", ground: "#e6d6bc", intensity: 1.5 },
      cut: "#1e2a2b",
      glow: "#e9b45c",
      rooms: null,
      pool: null,
      occlusion: 2.2,
    },
  },
  dark: {
    background: "#121b1c",
    paper: "#1a2627",
    ink: "#f2ece1",
    water: "#1c3a3e",
    intensity: { ambient: 2.6, sun: 1.2 },
    scene: {
      sky: { top: "#1c3a3e", horizon: "#c98a68" },
      // Dusk: the sun low in the west, warm.
      sun: { color: "#f0a06e", intensity: 1.5, position: [-46, 9, 14] },
      fill: { color: "#8fa6b0", ground: "#5a4c3d", intensity: 1.6 },
      cut: "#0c1314",
      glow: "#e9b45c",
      rooms: { color: "#ffc98a", intensity: 9 },
      pool: { color: "#7cc0c9", intensity: 14 },
      occlusion: 1.6,
    },
  },
};
