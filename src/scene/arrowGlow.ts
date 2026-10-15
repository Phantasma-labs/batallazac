import { Color, Vector2, type ShaderMaterial } from 'three'
import { OUTLINE_POINTS } from './arrowShape'
import type { HeightMap } from './heightMap'
import { ribbonMaterial } from './ribbonMaterial'

/** Bright pulses that can travel along one arrow at once (one per shell in the air). */
export const MAX_PULSES = 4

/**
 * The strip is `uGeom` to each side of the path (the arrow plus room for its glow and soft shadow). The shape itself is
 * drawn in the fragment shader, so the width follows the lens every frame without rebuilding anything: each vertex slides
 * along its sideways direction `norm`, then drops onto the terrain by reading the height map. Every column of the strip
 * finds its own height, so the arrow lies on a slope instead of being cut by it.
 */
export const ARROW_VERTEX = /* glsl */ `
  attribute float along;
  attribute float side;
  attribute vec2 norm;
  uniform float uGeom;
  uniform float uRaise;
  uniform vec2 uLight;
  uniform float uShadowOffset;
  uniform sampler2D uHeight;
  uniform vec4 uBox;
  varying float vAlong;
  varying float vSide;
  varying vec2 vShadow;
  void main() {
    vAlong = along;
    vSide = side;
    vec2 xz = position.xz + norm * side * uGeom;
    vec2 uv = vec2((xz.x - uBox.x) * uBox.z, (uBox.y - xz.y) * uBox.w);
    vec3 p = vec3(xz.x, texture2D(uHeight, uv).r + uRaise, xz.y);
    // The light's push on the ground (x, z), in the strip's own axes (along, across): where the contact shadow falls.
    vShadow = vec2(dot(uLight, vec2(norm.y, -norm.x)), dot(uLight, norm)) * uShadowOffset;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`

/**
 * A fat painted band lying on the ground, lit from inside: a tail tapering to a point, a body that swells, a notched head
 * twice as wide as the shaft. The fill is a tube: pale and hot along the core line, darker and softer toward the edge, with a
 * thin inked outline and, on the head, a lit rim. A faint glow spills over the ground round it and a soft contact shadow
 * sits beneath. Bright pulses run along it from the firing unit to the strike (one per shell in the air), and the unit end
 * flares with every shot, so the unit, the band and the impact read as one event. The outline is a polygon (uP, half of
 * it) and the distance to it gives clean edges at any size. `vAlong` is the distance along the path in world units,
 * `vSide * uGeom` the distance across it.
 */
const ARROW_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uHot;
  uniform vec3 uInk;
  uniform float uTime;
  uniform float uGeom;
  uniform float uBody;
  uniform float uStrength;
  uniform float uOpacity;
  uniform float uLong;
  uniform float uS0;
  uniform float uS1;
  uniform float uMuzzle;
  uniform float uPulse[${MAX_PULSES}];
  uniform vec2 uP[${OUTLINE_POINTS}];
  varying float vAlong;
  varying float vSide;
  varying vec2 vShadow;

  // Distance to the arrow (negative inside). The shape is mirrored about its axis, so the axis edge only counts for sign.
  float sdArrow(vec2 p) {
    p.y = abs(p.y);
    float d = 1e9;
    float sgn = 1.0;
    for (int i = 0; i < ${OUTLINE_POINTS}; i++) {
      int j = i == 0 ? ${OUTLINE_POINTS - 1} : i - 1;
      vec2 e = uP[j] - uP[i];
      vec2 w = p - uP[i];
      if (i != 0) {
        vec2 b = w - e * clamp(dot(w, e) / dot(e, e), 0.0, 1.0);
        d = min(d, dot(b, b));
      }
      bvec3 c = bvec3(p.y >= uP[i].y, p.y < uP[j].y, e.x * w.y > e.y * w.x);
      if (all(c) || all(not(c))) sgn = -sgn;
    }
    return sgn * sqrt(d);
  }

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  // The colours are in linear light like every other material, so convert each layer before it is premultiplied.
  vec3 out3(vec3 c) { return linearToOutputTexel(vec4(c, 1.0)).rgb; }

  void main() {
    float s = vAlong;
    float y = vSide * uGeom;
    vec2 p = vec2(s, y);
    float d = sdArrow(p);
    float px = max(fwidth(d), 1e-4);
    float dp = d / px; // distance in screen pixels
    float depthIn = max(-d, 0.0);

    float inside = 1.0 - smoothstep(-0.8, 0.8, dp);
    float u = clamp((s - uS0) / max(uS1 - uS0, 1.0), 0.0, 1.0);
    // The tail fades out into the ground; a very long arrow also thins out through its middle so it stays a hint.
    float tail = mix(0.12, 1.0, smoothstep(0.0, 0.42, u));
    float mid = 1.0 - uLong * 0.5 * smoothstep(0.12, 0.45, u) * (1.0 - smoothstep(0.55, 0.9, u));
    float env = tail * mid;
    float fade = smoothstep(0.0, 0.4, uStrength);

    // Pulses: a bright comet (sharp front, long tail) for every shell in the air, running from the unit to the strike.
    float sig = max(0.55 * uBody, 6.0);
    float pulse = 0.0;
    for (int k = 0; k < ${MAX_PULSES}; k++) {
      float ds = uPulse[k] - s;
      pulse += uPulse[k] < 0.0 ? 0.0 : (ds >= 0.0 ? exp(-ds / (2.4 * sig)) : exp(-pow(ds / (0.45 * sig), 2.0)));
    }
    pulse = clamp(pulse, 0.0, 1.4);

    // Pigment: faint streaks along the brush stroke, a tube that is pale and hot at its core and soft and dark at the edge.
    float grain = vnoise(vec2(s / (uBody * 1.6) - uTime * 0.12, y / (uBody * 0.3)));
    float flowPhase = fract(s / (uBody * 3.4) - uTime * 0.42);
    float flow = smoothstep(0.0, 0.8, flowPhase) * (1.0 - smoothstep(0.8, 1.0, flowPhase));
    float tube = smoothstep(0.0, 0.5 * uBody, depthIn);
    float coreLine = exp(-pow(y / (0.11 * uBody), 2.0)) * smoothstep(-0.2 * uBody, 0.6 * uBody, (uS1 - s)) ;
    float nearHead = smoothstep(0.55, 1.0, u);
    float edgeSoft = 1.0 - smoothstep(0.0, 0.22 * uBody, depthIn);

    vec3 fill = mix(uColor * 0.8, uColor, tube);
    fill = mix(fill, uHot, min(0.16 * tube * tube + 0.22 * flow * tube + 0.3 * nearHead * tube + 0.62 * coreLine * (0.55 + 0.45 * tube) + 0.5 * min(pulse, 1.0), 0.92));
    fill *= 0.93 + 0.14 * grain;
    fill = mix(fill, uInk, 0.5 * edgeSoft);
    // The head: its edge is lit, like a bevel catching the light.
    float headZone = step(uP[${OUTLINE_POINTS - 2}].x - 0.25 * uBody, s);
    float lit = headZone * smoothstep(0.015 * uBody, 0.05 * uBody, depthIn) * (1.0 - smoothstep(0.05 * uBody, 0.15 * uBody, depthIn));
    fill = mix(fill, uHot * 1.25, 0.8 * lit);

    float aBody = inside * clamp(uOpacity * env * (0.92 + 0.08 * grain) * (0.88 + 0.22 * tube + 0.2 * coreLine + 0.25 * pulse), 0.0, 1.0) * fade;

    // A thin inked outline, strongest where the arrow is.
    float ink = (1.0 - smoothstep(0.5, 1.8, abs(dp + 0.9))) * 0.85 * mix(0.15, 1.0, smoothstep(0.0, 0.3, u)) * (1.0 - 0.45 * uLong) * fade;

    // Soft contact shadow: the same shape pushed away from the light and blurred. It darkens the ground beside the arrow
    // and (less) beneath it.
    float ds2 = sdArrow(p - vShadow);
    float shadow = (1.0 - smoothstep(-0.2 * uBody, 0.9 * uBody, ds2)) * 0.42 * mix(0.45, 1.0, step(0.0, d)) * env * fade;

    vec3 shadowCol = out3(vec3(0.075, 0.045, 0.02));
    vec3 inkCol = out3(uInk);
    vec3 bodyCol = out3(fill);
    float a = aBody + shadow * (1.0 - aBody);
    vec3 rgb = bodyCol * aBody + shadowCol * shadow * (1.0 - aBody);
    rgb = inkCol * ink + rgb * (1.0 - ink);
    a = ink + a * (1.0 - ink);

    // Light: a faint glow spilling over the ground round the band, a flare where the unit fires, and the pulses. All of it is
    // added (no alpha), so it reads as lit by the scene rather than painted on.
    float spill = exp(-max(d, 0.0) / (0.5 * uBody)) * env;
    vec2 q = p - vec2(uS0, 0.0);
    float flare = exp(-dot(q, q) / pow(1.25 * uBody, 2.0)) * (0.3 + 0.7 * uMuzzle);
    float light = (0.34 * spill + 0.55 * flare + 0.55 * pulse * (0.4 + 0.6 * exp(-max(-d, 0.0) / (0.3 * uBody))) + 0.2 * coreLine) * fade;
    vec3 glowCol = out3(uHot);
    gl_FragColor = vec4(rgb + glowCol * light * (0.35 + 0.65 * (1.0 - a)), a);
  }
`

/** A deeper, browner version of a lane colour, for the ink outline and the pooled edges of the paint. */
export const inkOf = (color: Color) => color.clone().multiplyScalar(0.3).lerp(new Color(0.12, 0.065, 0.03), 0.45)
/** A warmer, lighter version, for the arrow's hot core. */
export const hotOf = (color: Color) => color.clone().lerp(new Color(1, 0.93, 0.7), 0.5)

export function arrowMaterial(color: string, height: HeightMap): ShaderMaterial {
  const base = new Color(color)
  return ribbonMaterial(
    ARROW_FRAGMENT,
    {
      uColor: { value: base },
      uHot: { value: hotOf(base) },
      uInk: { value: inkOf(base) },
      uTime: { value: 0 },
      uGeom: { value: 1 },
      uBody: { value: 1 },
      uRaise: { value: 0 },
      uStrength: { value: 0 },
      uOpacity: { value: 0.66 },
      uLong: { value: 0 },
      uS0: { value: 0 },
      uS1: { value: 1 },
      uMuzzle: { value: 0 },
      uPulse: { value: new Array(MAX_PULSES).fill(-1) },
      uP: { value: Array.from({ length: OUTLINE_POINTS }, () => new Vector2()) },
      uLight: { value: new Vector2(0, 1) },
      uShadowOffset: { value: 0 },
      uHeight: { value: height.texture },
      uBox: { value: height.box },
    },
    { vertexShader: ARROW_VERTEX, premultiplied: true },
  )
}
