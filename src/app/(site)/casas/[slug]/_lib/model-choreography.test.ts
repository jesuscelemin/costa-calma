import { describe, expect, test } from "vitest";

import { modelAt, modelPhases } from "./model-choreography";

// Villa Mar's floors, from the plot up.
const floors = [
  { kind: "plot" },
  { kind: "storey" },
  { kind: "storey" },
  { kind: "roof" },
] as const;
const [PLOT, GROUND, FIRST, ROOF] = [0, 1, 2, 3];

describe("the house model's choreography", () => {
  test("starts on the empty plot: no house on it yet and the pool dry", () => {
    const { floors: state, pool, phase } = modelAt(0, floors);
    expect(phase).toBe("plot");
    expect(state[PLOT]).toMatchObject({ opacity: 1, lift: 0 });
    for (const index of [GROUND, FIRST, ROOF]) {
      expect(state[index]).toMatchObject({ opacity: 0, plan: 0, walls: 0, light: 0 });
    }
    expect(pool).toBe(0);
  });

  test("ends on the open house: every floor built, lit and apart from the one below", () => {
    const { floors: state, pool, phase } = modelAt(1, floors);
    expect(phase).toBe("open");
    for (const index of [GROUND, FIRST, ROOF]) {
      expect(state[index]).toMatchObject({ opacity: 1, plan: 1, walls: 1, solid: 1, light: 1 });
    }
    expect(state[FIRST]!.lift).toBeGreaterThan(state[GROUND]!.lift);
    expect(state[ROOF]!.lift).toBeGreaterThan(state[FIRST]!.lift);
    expect(pool).toBe(1);
  });

  // The middle of each phase, as a visitor stops scrolling there.
  const middle = (id: string) => {
    const index = modelPhases.findIndex((phase) => phase.id === id);
    return ((modelPhases[index - 1]?.end ?? 0) + modelPhases[index]!.end) / 2;
  };

  test("goes through its phases in order: plot, ink plan, walls, storeys, open house", () => {
    expect(modelPhases.map(({ id }) => id)).toEqual(["plot", "plan", "walls", "storeys", "open"]);
    for (const { id } of modelPhases) expect(modelAt(middle(id), floors).phase).toBe(id);
  });

  test("halfway through the ink plan, the ground floor is half drawn and has no walls", () => {
    const { floors: state, pool } = modelAt(middle("plan"), floors);
    expect(state[GROUND]!.opacity).toBe(1);
    expect(state[GROUND]!.plan).toBeCloseTo(0.5);
    expect(state[GROUND]!.walls).toBe(0);
    expect(state[GROUND]!.solid).toBe(0);
    expect(state[FIRST]!.opacity).toBe(0);
    expect(pool).toBe(0);
  });

  test("once the walls are up, the ground floor stands built and the pool is full", () => {
    const { floors: state, pool } = modelAt(modelPhases[2].end, floors);
    expect(state[GROUND]).toMatchObject({ plan: 1, walls: 1, solid: 1, lift: 0 });
    expect(state[FIRST]!.opacity).toBe(0);
    expect(pool).toBe(1);
  });

  test("the storeys above are built one after the other, the roof last", () => {
    const { floors: state } = modelAt(middle("storeys"), floors);
    expect(state[FIRST]!.opacity).toBe(1);
    expect(state[FIRST]!.walls).toBe(1);
    expect(state[ROOF]!.walls).toBe(0);
    const built = modelAt(modelPhases[3].end, floors).floors;
    expect(built[ROOF]).toMatchObject({ opacity: 1, walls: 1 });
    // Still stacked: the house only opens in the last phase.
    for (const index of [GROUND, FIRST, ROOF]) expect(built[index]!.lift).toBe(0);
  });

  test("every floor and the pool only move forward as the scroll does, and back as it returns", () => {
    const steps = Array.from({ length: 201 }, (_, i) => i / 200);
    const states = steps.map((progress) => modelAt(progress, floors));
    for (const [i, state] of states.entries()) {
      const previous = states[i - 1];
      if (!previous) continue;
      expect(state.pool).toBeGreaterThanOrEqual(previous.pool);
      expect(state.camera.distance).toBeGreaterThanOrEqual(previous.camera.distance);
      expect(state.camera.targetY).toBeGreaterThanOrEqual(previous.camera.targetY);
      for (const [index, floor] of state.floors.entries()) {
        for (const key of ["lift", "opacity", "plan", "walls", "solid", "light"] as const) {
          expect(floor[key]).toBeGreaterThanOrEqual(previous.floors[index]![key]);
        }
      }
    }
  });

  test("the camera looks further down onto the ink plan than at the empty plot", () => {
    expect(modelAt(middle("plan"), floors).camera.polar).toBeLessThan(
      modelAt(0, floors).camera.polar,
    );
    // And frames the open house from further away, looking at its middle.
    const open = modelAt(1, floors).camera;
    expect(open.distance).toBeGreaterThan(modelAt(0, floors).camera.distance);
    expect(open.targetY).toBeGreaterThan(modelAt(0, floors).camera.targetY);
  });

  test("scroll outside the stretch keeps the first or the last state", () => {
    expect(modelAt(-0.5, floors)).toEqual(modelAt(0, floors));
    expect(modelAt(1.5, floors)).toEqual(modelAt(1, floors));
  });

  test("a single-storey house opens too: its roof lifts off its only storey", () => {
    const duna = [{ kind: "plot" }, { kind: "storey" }, { kind: "roof" }] as const;
    const { floors: state } = modelAt(1, duna);
    expect(state[2]!.lift).toBeGreaterThan(state[1]!.lift);
    expect(state[2]).toMatchObject({ opacity: 1, walls: 1 });
  });
});
