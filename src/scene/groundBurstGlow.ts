import { Color, NormalBlending, ShaderMaterial, Vector2, Vector4 } from 'three'
import type { HeightMap } from './heightMap'
import { MAX_SHELLS } from './impactEffect'

/** The quad is laid on the terrain by reading the height map in the vertex shader, so the scorch and rings follow the slopes. */
const VERTEX = /* glsl */ `
  uniform vec2 uCenter;
  uniform float uScale;
  uniform sampler2D uHeight;
  uniform vec4 uBox;
  varying vec2 vUv;
  void main() {
    vUv = position.xz * 0.5 + 0.5;
    vec2 xz = uCenter + position.xz * uScale;
    vec2 uv = vec2((xz.x - uBox.x) * uBox.z, (uBox.y - xz.y) * uBox.w);
    gl_Position = projectionMatrix * viewMatrix * vec4(xz.x, texture2D(uHeight, uv).r + 1.4, xz.y, 1.0);
  }
`

/**
 * What the shells do to the ground, drawn flat on the terrain around the target: a soot-black scorch patch that stays
 * and spreads while the attack lasts, for each shell a pool of firelight at the impact and a ring of dust racing out
 * from it (pale, with a dark inner edge), and a steady ember glow under the fire. Coordinates are in effect units (the
 * quad spans uRadius of them each way), so the same shader serves every zoom.
 */
const FRAGMENT = /* glsl */ `
  uniform vec4 uRing[${MAX_SHELLS}];   // spread, alpha, x, z of each shell's ring
  uniform float uLevel[${MAX_SHELLS}]; // brightness of each shell's flash
  uniform vec3 uFire;
  uniform float uStrength;
  uniform float uCore;
  uniform float uRadius;
  varying vec2 vUv;
  vec3 out3(vec3 c) { return linearToOutputTexel(vec4(c, 1.0)).rgb; }
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  void main() {
    vec2 q = vUv * 2.0 - 1.0;
    vec2 p = q * uRadius;
    float edge = 1.0 - smoothstep(0.7, 1.0, length(q));
    // Soot: a ragged patch, darkest at the middle.
    float rag = 0.75 + 0.5 * vnoise(p * 1.7);
    float scorch = exp(-dot(p, p) / (2.8 * rag)) * 0.78;
    float ring = 0.0;
    float inner = 0.0;
    float glow = 0.0;
    for (int i = 0; i < ${MAX_SHELLS}; i++) {
      vec4 b = uRing[i];
      float dist = length(p - b.zw);
      float r = 0.35 + 2.1 * b.x;
      float w = 0.16 + 0.15 * b.x;
      ring = max(ring, exp(-pow((dist - r) / w, 2.0)) * b.y);
      inner = max(inner, exp(-pow((dist - r + 0.2 + 0.1 * b.x) / (w * 0.8), 2.0)) * b.y);
      glow = max(glow, exp(-dist * dist / 0.55) * uLevel[i]);
    }
    glow = max(glow, exp(-dot(p, p) / 0.8) * 0.5 * uCore);
    float aSoot = clamp(scorch + inner * 0.45, 0.0, 1.0) * edge * uStrength;
    float aDust = ring * 0.62 * edge * uStrength;
    vec3 soot = out3(vec3(0.045, 0.03, 0.022));
    vec3 dust = out3(vec3(0.82, 0.7, 0.52));
    vec3 light = out3(uFire) * glow * 0.9 * edge * uStrength;
    // Soot first, dust ring over it, firelight added last (it carries no alpha).
    vec3 rgb = soot * aSoot;
    float a = aSoot;
    rgb = dust * aDust + rgb * (1.0 - aDust);
    a = aDust + a * (1.0 - aDust);
    gl_FragColor = vec4(rgb + light * (1.0 - a), a);
  }
`

/** How far the quad reaches from the target, in effect units. */
export const GROUND_RADIUS = 3.2

export function groundBurstMaterial(fire: string, height: HeightMap): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: {
      uRing: { value: Array.from({ length: MAX_SHELLS }, () => new Vector4()) },
      uLevel: { value: new Array(MAX_SHELLS).fill(0) },
      uFire: { value: new Color(fire).lerp(new Color(1, 0.45, 0.1), 0.55) },
      uStrength: { value: 0 },
      uCore: { value: 0 },
      uRadius: { value: GROUND_RADIUS },
      uCenter: { value: new Vector2() },
      uScale: { value: 1 },
      uHeight: { value: height.texture },
      uBox: { value: height.box },
    },
    transparent: true,
    depthWrite: false,
    blending: NormalBlending,
    premultipliedAlpha: true,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  })
}
