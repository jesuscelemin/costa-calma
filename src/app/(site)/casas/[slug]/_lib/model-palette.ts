// The house model's colours in Día and Noche: an architect's matt model, light slabs and walls.
// The background, the ink and the lights are the brand's tokens (model-palette.test.ts checks
// them against tokens.css); the rest are materials, not interface colours.

export type ModelPalette = {
  dark: boolean;
  /** The page behind the model: `surface`. */
  background: string;
  /** The ink plan: `ink`. */
  ink: string;
  /** Warm interior light: `sol`. */
  light: string;
  slab: string;
  wall: string;
  glass: string;
  joinery: string;
  deck: string;
  land: string;
  landSide: string;
  basin: string;
  water: string;
  foliage: string;
  trunk: string;
};

export const modelPalettes: Record<"light" | "dark", ModelPalette> = {
  light: {
    dark: false,
    background: "#f6f1e8",
    ink: "#1e2a2b",
    light: "#e9b45c",
    slab: "#fffdf9",
    wall: "#fbf8f2",
    glass: "#cfe6ea",
    joinery: "#2f3a3b",
    deck: "#d9bf98",
    land: "#c9cfa4",
    landSide: "#e6d6bc",
    basin: "#e9e2d6",
    water: "#3d8c99",
    foliage: "#6f7f48",
    trunk: "#8a6748",
  },
  dark: {
    dark: true,
    background: "#121b1c",
    ink: "#f2ece1",
    light: "#e9b45c",
    slab: "#d8d2c8",
    wall: "#cfc8bd",
    glass: "#7cc0c9",
    joinery: "#1b2526",
    deck: "#a9875f",
    land: "#5f6e3f",
    landSide: "#3b3429",
    basin: "#a8a196",
    water: "#2f7f8c",
    foliage: "#4b5a2e",
    trunk: "#5d4430",
  },
};
