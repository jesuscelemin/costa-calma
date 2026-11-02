// The house model's colours in Día and Noche: an architect's matt model, light slabs and walls.
// The background, the ink and the interior light are the brand's tokens (model-palette.test.ts checks
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
  /** The sky's and the ground's light, and the sun's (the moon's by night). */
  sky: string;
  groundLight: string;
  sun: string;
  /** How strong each light is: the sky, the sun, the interior lamps and their ceiling panels. */
  intensity: {
    sky: number;
    sun: number;
    lamp: number;
    panel: number;
    water: number;
    bloom: number;
  };
  /** Resting opacity of glass. */
  glassOpacity: number;
  /** Ambient occlusion: by night it greys the background against the page. */
  occlusion: boolean;
  /** By night the lights are on as soon as a floor is built; by day only once the house opens. */
  lightsWhenBuilt: boolean;
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
    sky: "#fff6e8",
    groundLight: "#c9b89a",
    sun: "#fff1dc",
    intensity: { sky: 1.1, sun: 1.8, lamp: 6, panel: 2.5, water: 0.15, bloom: 0.5 },
    glassOpacity: 0.25,
    occlusion: true,
    lightsWhenBuilt: false,
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
    sky: "#3a4d6b",
    // Noche's surface-sunken.
    groundLight: "#0c1314",
    sun: "#a9bde0",
    intensity: { sky: 0.7, sun: 0.9, lamp: 18, panel: 5, water: 0.6, bloom: 1 },
    glassOpacity: 0.35,
    occlusion: false,
    lightsWhenBuilt: true,
  },
};
