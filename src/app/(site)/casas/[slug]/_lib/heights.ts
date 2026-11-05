// A house's heights, apart from the geometry that uses them: the overlays read them without
// loading the plan module.

/** From one floor's finished floor to the next: +0,00, +3,20, +6,40. The corte reads it too. */
export const STOREY_HEIGHT = 3.2;
export const SLAB_DEPTH = 0.3;
/** Walls stand from their floor up to the slab above. */
export const WALL_HEIGHT = STOREY_HEIGHT - SLAB_DEPTH;
