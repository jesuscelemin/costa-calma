import * as THREE from "three";

// The house model's materials, made in code (ADR 0006): no photographic textures, only colour and a
// subtle variation drawn by the shader from where each point is in the world. Every material reads
// the same sweep, room by room (ADR 0010): where its room's sweep has not reached yet, it is still
// paper, shaded as a drawing is; where it has crossed, the material under the theme's light. Its
// leading edge is a thin line of light. Where the house is cut, the inside of its walls and slabs
// shows as the solid cut: the poché of the plan.

/** Each material's pattern, as the shader draws it. */
export const MATERIALS = {
  /** Light microcement: the floors, the slabs and the stair. */
  microcement: { pattern: 1, color: "#d8d1c5", roughness: 0.82 },
  /** Oak: doors, rails, decks and the pines' trunks. */
  oak: { pattern: 2, color: "#9c7552", roughness: 0.7 },
  /** White lime: the walls, their lintels and the eaves. */
  lime: { pattern: 3, color: "#f2ede3", roughness: 0.92 },
  /** Stone: the paving round the pool, its basin, the planters' sides. */
  stone: { pattern: 4, color: "#cdbb9c", roughness: 0.88 },
  /** The plot's ground: dry garden on top, earth in the cut. */
  ground: { pattern: 5, color: "#9aa071", roughness: 1 },
  /** The pines' crowns and the planters' herbs. */
  foliage: { pattern: 6, color: "#55643b", roughness: 0.95 },
  /** The pool's water. */
  water: { pattern: 7, color: "#2e7f89", roughness: 0.08 },
  /** The windows' and railings' glass. */
  glass: { pattern: 8, color: "#cfe3e5", roughness: 0.05 },
} as const;

export type MaterialId = keyof typeof MATERIALS;

/** The most rooms a house's sweep keeps track of: Villa Mar has 27, with its plot's. */
export const MAX_ROOMS = 40;

/** The sweep's uniforms, one set the whole house shares, so the scene moves them once a frame. */
export type SweepUniforms = {
  /** How many of the rooms below are in use. */
  uRoomCount: { value: number };
  /** Each room's box on the plan: x and z where it starts, x and z where it ends. */
  uRoomBox: { value: THREE.Vector4[] };
  /**
   * Each room's heights and sweep: from and to which height it holds what is in it, the axis its
   * sweep runs along (0 +x, 1 −x, 2 +z, 3 −z), and where its front stands along it, in metres.
   */
  uRoomSweep: { value: THREE.Vector4[] };
  /** How wide the sweep's soft edge is, in metres. */
  uBand: { value: number };
  /** The drawing's light: its even light and its sun, and where the sun comes from. */
  uPaperLight: { value: THREE.Vector2 };
  uPaperSun: { value: THREE.Vector3 };
  uCut: { value: THREE.Color };
  /** What the cut shows on paper: the plan's poché, in ink. */
  uPoche: { value: THREE.Color };
  uGlow: { value: THREE.Color };
};

export function sweepUniforms(): SweepUniforms {
  return {
    uRoomCount: { value: 0 },
    uRoomBox: { value: Array.from({ length: MAX_ROOMS }, () => new THREE.Vector4()) },
    uRoomSweep: { value: Array.from({ length: MAX_ROOMS }, () => new THREE.Vector4()) },
    uBand: { value: 1.5 },
    uPaperLight: { value: new THREE.Vector2(2.4, 0.9) },
    uPaperSun: { value: new THREE.Vector3(-20, 30, 12).normalize() },
    uCut: { value: new THREE.Color() },
    uPoche: { value: new THREE.Color() },
    uGlow: { value: new THREE.Color() },
  };
}

/**
 * How far its room's sweep has crossed a point, 0–1, and its leading edge, a thin line of light,
 * in GLSL: the same in every material. The point is looked up in the first room whose box holds it.
 */
const SWEPT_GLSL = /* glsl */ `
  #define MAX_ROOMS ${MAX_ROOMS}
  uniform int uRoomCount;
  uniform vec4 uRoomBox[MAX_ROOMS];
  uniform vec4 uRoomSweep[MAX_ROOMS];
  uniform float uBand;
  varying vec3 vSweepWorld;
  float alongAxis(vec3 q, float axis) {
    return axis < 0.5 ? q.x : axis < 1.5 ? -q.x : axis < 2.5 ? q.z : -q.z;
  }
  vec3 roomSweep(vec3 q) {
    for (int i = 0; i < MAX_ROOMS; i++) {
      if (i >= uRoomCount) break;
      vec4 box = uRoomBox[i];
      vec4 sweep = uRoomSweep[i];
      if (q.x >= box.x && q.x < box.z && q.z >= box.y && q.z < box.w && q.y >= sweep.x && q.y < sweep.y) {
        float along = alongAxis(q, sweep.z);
        float done = 1.0 - smoothstep(sweep.w - uBand, sweep.w, along);
        float edge = 1.0 - smoothstep(0.0, 0.05, abs(along - (sweep.w - uBand * 0.5)));
        // Just behind the front, where its joints still glow: a metre and a half that fades.
        float behind = (sweep.w - uBand * 0.5) - along;
        float band = step(0.0, behind) * (1.0 - smoothstep(0.0, 1.6, behind));
        return vec3(done, edge, band);
      }
    }
    return vec3(0.0);
  }
  // The joints of a floor's or a ceiling's tiles or panels, 60 cm apart: where the front glows.
  float joints(vec3 p, vec3 n) {
    if (abs(n.y) < 0.5) return 0.0;
    vec2 cell = fract(p.xz / 0.6);
    vec2 edge = min(cell, 1.0 - cell);
    return 1.0 - smoothstep(0.01, 0.03, min(edge.x, edge.y));
  }
`;

const NOISE_GLSL = /* glsl */ `
  float hash3(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float noise3(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash3(i), hash3(i + vec3(1, 0, 0)), f.x),
          mix(hash3(i + vec3(0, 1, 0)), hash3(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(hash3(i + vec3(0, 0, 1)), hash3(i + vec3(1, 0, 1)), f.x),
          mix(hash3(i + vec3(0, 1, 1)), hash3(i + vec3(1, 1, 1)), f.x), f.y),
      f.z);
  }
  float fbm(vec3 p) {
    return 0.5 * noise3(p) + 0.3 * noise3(p * 2.03) + 0.2 * noise3(p * 4.11);
  }
`;

/** Each pattern's variation of the material's colour, around 1, from the point and its normal. */
const PATTERN_GLSL = /* glsl */ `
  varying vec3 vSweepNormal;
  uniform vec3 uPaperColor;
  vec3 pattern(vec3 color) {
    vec3 p = vSweepWorld;
    vec3 n = normalize(vSweepNormal);
    #if PATTERN == 1
      // Microcement: soft clouds, a trowel's faint marks.
      color *= 1.0 + 0.08 * (fbm(p * 0.7) - 0.5) + 0.03 * (noise3(p * 7.0) - 0.5);
    #elif PATTERN == 2
      // Oak: grain along the longer run, broken by slow waves, and boards 18 cm wide.
      float run = abs(n.y) > 0.5 ? p.z : p.y;
      float grain = sin(run * 90.0 + fbm(p * vec3(0.6, 3.0, 0.6)) * 9.0);
      float board = step(0.012, fract((abs(n.y) > 0.5 ? p.x : p.z) / 0.18));
      color *= (1.0 + 0.06 * grain) * mix(0.82, 1.0, board);
    #elif PATTERN == 3
      // Lime: a wash, faintly uneven.
      color *= 1.0 + 0.05 * (fbm(p * 1.2) - 0.5);
    #elif PATTERN == 4
      // Stone: laid in 60 × 40 cm pieces, each its own shade, with their joints.
      vec2 q = abs(n.y) > 0.5 ? p.xz : (abs(n.x) > 0.5 ? p.zy : p.xy);
      vec2 cell = floor(q / vec2(0.6, 0.4));
      vec2 inCell = fract(q / vec2(0.6, 0.4));
      float joint = step(0.04, inCell.x) * step(0.06, inCell.y);
      color *= (0.92 + 0.14 * hash3(vec3(cell, 3.0))) * mix(0.78, 1.0, joint);
      color *= 1.0 + 0.06 * (fbm(p * 3.0) - 0.5);
    #elif PATTERN == 5
      // The ground: dry grass and gravel on top, warm earth in the cut.
      if (n.y > 0.5) {
        float patches = smoothstep(0.35, 0.65, fbm(p * 0.35));
        color = mix(color, vec3(0.62, 0.55, 0.42), patches * 0.55);
        color *= 1.0 + 0.12 * (noise3(p * 5.0) - 0.5);
      } else {
        color = vec3(0.47, 0.37, 0.27) * (1.0 + 0.1 * (fbm(p * 2.0) - 0.5));
      }
    #elif PATTERN == 6
      // Foliage: clumps of light and shade.
      color *= 0.8 + 0.4 * fbm(p * 1.6);
    #elif PATTERN == 7
      // Water: a faint ripple across its surface.
      color *= 1.0 + 0.08 * (fbm(vec3(p.xz * 1.4, 0.0)) - 0.5);
    #endif
    return color;
  }
`;

/** The material as the corte draws it: paper, lit by its own even light and sun. */
const PAPER_GLSL = /* glsl */ `
  uniform vec2 uPaperLight;
  uniform vec3 uPaperSun;
  uniform vec3 uCut;
  uniform vec3 uPoche;
  uniform vec3 uGlow;
  // What the cut shows inside what it cuts: earth in the land, water in the pool, else solid.
  vec3 cut(vec3 material) {
    #if PATTERN == 5
      return vec3(0.25, 0.17, 0.11) * (1.0 + 0.15 * (fbm(vSweepWorld * 2.0) - 0.5));
    #elif PATTERN == 7
      return material * 0.7;
    #else
      return uCut;
    #endif
  }
  vec3 paper() {
    float sun = max(dot(normalize(vSweepNormal), uPaperSun), 0.0);
    return uPaperColor * (uPaperLight.x + uPaperLight.y * sun) * RECIPROCAL_PI;
  }
`;

const VERTEX_DECLARATIONS = /* glsl */ `
  varying vec3 vSweepWorld;
  varying vec3 vSweepNormal;
`;
const VERTEX_BODY = /* glsl */ `
  vSweepWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
  vSweepNormal = normalize(mat3(modelMatrix) * objectNormal);
`;

type Shader = THREE.WebGLProgramParametersWithUniforms;

function addVertex(shader: Shader) {
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", `#include <common>\n${VERTEX_DECLARATIONS}`)
    .replace("#include <worldpos_vertex>", `#include <worldpos_vertex>\n${VERTEX_BODY}`);
}

export type SweepMaterial = THREE.MeshStandardMaterial & {
  userData: {
    /** The colour this material is as paper: the drawing's paper, or the water's tone. */
    paperColor: { value: THREE.Color };
    /** The sweep's uniforms, shared with every other material of the house. */
    sweep: SweepUniforms;
  };
};

/**
 * One of the house's materials, on the shared sweep. Glass is see-through once swept and gone on
 * paper, where the drawing only keeps its outline; everything else is double-sided, for the cut to
 * show the inside of what it cuts as solid.
 */
export function sweepMaterial(id: MaterialId, uniforms: SweepUniforms, clipping: THREE.Plane[]) {
  const { pattern, color, roughness } = MATERIALS[id];
  const glass = id === "glass";
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness: 0,
    side: glass ? THREE.FrontSide : THREE.DoubleSide,
    shadowSide: THREE.FrontSide,
    clippingPlanes: clipping,
    clipShadows: true,
    transparent: glass,
    depthWrite: !glass,
    // Lines over faces: the faces step back a little, so their own edges never flicker.
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  }) as SweepMaterial;
  material.defines = { PATTERN: pattern };
  material.userData.paperColor = { value: new THREE.Color() };
  material.userData.sweep = uniforms;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms, { uPaperColor: material.userData.paperColor });
    addVertex(shader);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>\n${SWEPT_GLSL}\n${NOISE_GLSL}\n${PATTERN_GLSL}\n${PAPER_GLSL}`,
      )
      .replace(
        "#include <color_fragment>",
        // A face is looked up a step in front of it, in the room it faces; the cut's inside, where it is.
        `#include <color_fragment>
        vec3 roomState = roomSweep(vSweepWorld + (gl_FrontFacing ? normalize(vSweepNormal) * 0.12 : vec3(0.0)));
        diffuseColor.rgb = pattern(diffuseColor.rgb);`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        "#include <emissivemap_fragment>\ntotalEmissiveRadiance *= roomState.x;",
      )
      .replace(
        "#include <opaque_fragment>",
        /* glsl */ `#include <opaque_fragment>
        {
          float done = roomState.x;
          vec3 colour = gl_FrontFacing ? gl_FragColor.rgb : cut(diffuseColor.rgb);
          float edge = roomState.y * step(0.002, done) * step(done, 0.998);
          float glow = roomState.z * joints(vSweepWorld, normalize(vSweepNormal)) * (gl_FrontFacing ? 1.0 : 0.0);
          vec3 drawn = gl_FrontFacing ? paper() : uPoche;
          gl_FragColor.rgb = mix(drawn, colour, done) + uGlow * edge * 0.9;
          gl_FragColor.rgb = mix(gl_FragColor.rgb, uGlow, glow * 0.85);
          ${glass ? "gl_FragColor.a = opacity * done;" : ""}
        }`,
      );
  };
  return material;
}

/**
 * The house's ink lines, which the sweep leaves behind it: they fade as the band crosses them.
 * The lens fades them in with the material's own opacity.
 */
export function sweepLines(uniforms: SweepUniforms, clipping: THREE.Plane[]) {
  const material = new THREE.LineBasicMaterial({
    clippingPlanes: clipping,
    transparent: true,
    opacity: 0,
  });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\nvarying vec3 vSweepWorld;`)
      .replace(
        "#include <worldpos_vertex>",
        "#include <worldpos_vertex>\nvSweepWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${SWEPT_GLSL}`)
      .replace(
        "#include <opaque_fragment>",
        "#include <opaque_fragment>\ngl_FragColor.a *= 1.0 - roomSweep(vSweepWorld).x;",
      );
  };
  return material;
}

/**
 * The sky the sweep opens onto, a dome round the scene: from the paper, at rest, to the theme's
 * sky, from its horizon at the bottom of the screen to its top. It follows the sweep as a whole, not its band.
 */
export function skyMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uPaper: { value: new THREE.Color() },
      uTop: { value: new THREE.Color() },
      uHorizon: { value: new THREE.Color() },
      uSky: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDirection;
      void main() {
        // Up as the camera sees it: the sky runs from the bottom of the screen to its top.
        vDirection = normalize((modelViewMatrix * vec4(position, 1.0)).xyz);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uPaper;
      uniform vec3 uTop;
      uniform vec3 uHorizon;
      uniform float uSky;
      varying vec3 vDirection;
      void main() {
        float up = smoothstep(-0.32, 0.3, vDirection.y);
        vec3 sky = mix(uHorizon, uTop, up);
        gl_FragColor = vec4(mix(uPaper, sky, uSky), 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
}

/**
 * A sheet's drawing on its floor: its canvas, gone wherever its room has turned into colour, its
 * ink glowing for a moment just behind the front; and cut with the house.
 */
export function sweepDrawingMaterial(
  texture: THREE.Texture,
  uniforms: SweepUniforms,
  clipping: THREE.Plane[],
) {
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    clippingPlanes: clipping,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\nvarying vec3 vSweepWorld;`)
      .replace(
        "#include <worldpos_vertex>",
        "#include <worldpos_vertex>\nvSweepWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${SWEPT_GLSL}`)
      .replace(
        "#include <opaque_fragment>",
        // Looked up a little over the floor it lies on, in its room.
        `#include <opaque_fragment>
        {
          vec3 state = roomSweep(vSweepWorld + vec3(0.0, 0.05, 0.0));
          gl_FragColor.a *= 1.0 - state.x;
        }`,
      );
  };
  return material;
}
