import { AddEquation, Color, CustomBlending, DoubleSide, OneFactor, OneMinusSrcAlphaFactor, ShaderMaterial } from 'three'

/** The strip is this many times wider than the dashes' half width, so a soft glow can spread past them. */
export const GLOW_REACH = 2.3
/** World length of one dash and its gap. */
export const DASH_PERIOD = 26

const VERTEX = /* glsl */ `
  attribute vec2 across;
  attribute float along;
  attribute float side;
  uniform float uHalf;
  varying float vAlong;
  varying float vSide;
  void main() {
    vec3 p = position;
    p.xz += across * side * uHalf * ${GLOW_REACH.toFixed(2)};
    vAlong = along;
    vSide = side;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`

/**
 * A march's trail, drawn like ink on the map: chunky rounded dashes in the lane's colour with a dark outline, on a thin
 * continuous line of the same colour, fully shown from the start of the path up to `uProgress` and (only while it is under
 * way) a faint dotted preview of the rest. Near the unit the trail also glows, fading with distance behind it. The output is
 * premultiplied, so the ink covers the parchment while the glow adds light to it.
 */
const FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uInk;
  uniform float uProgress;
  uniform float uLength;
  uniform float uHalf;
  uniform float uFlow;
  uniform float uOpacity;
  uniform float uPx;
  uniform float uGhost;
  uniform float uGlow;
  varying float vAlong;
  varying float vSide;

  float roundBox(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }

  void main() {
    float u = vAlong * uLength;
    float v = vSide * uHalf * ${GLOW_REACH.toFixed(2)};
    float headU = uProgress * uLength;
    float aa = max(uPx, 1e-3);
    float reveal = 1.0 - smoothstep(headU - aa * 2.0, headU, u);

    // Dashes: rounded bars, outlined in ink.
    float period = ${DASH_PERIOD.toFixed(1)};
    float cell = mod(u - uFlow, period) - period * 0.5;
    float d = roundBox(vec2(cell, v), vec2(period * 0.33, uHalf * 0.62), uHalf * 0.34);
    float ink = 1.0 - smoothstep(aa * 1.5 - aa, aa * 1.5 + aa, d);
    float fill = 1.0 - smoothstep(-aa, aa, d + aa * 1.3);

    // A thin continuous line under them, so the route reads as one path.
    float line = (1.0 - smoothstep(uHalf * 0.17 - aa, uHalf * 0.17 + aa, abs(v))) * 0.6;

    vec4 c = vec4(uColor * line, line);
    c = vec4(uInk * ink, ink) + c * (1.0 - ink);
    c = vec4(uColor * fill, fill) + c * (1.0 - fill);
    c *= reveal * uOpacity;

    // The rest of the route, faint dots, while the march is on.
    float dots = (1.0 - smoothstep(uHalf * 0.16 - aa, uHalf * 0.16 + aa, abs(v))) * step(mod(u, 9.0), 3.4);
    float ghost = dots * 0.42 * uGhost * (1.0 - reveal);
    c += vec4(uColor * ghost, ghost);

    // Glow, brightest at the unit and fading behind it.
    float behind = max(headU - u, 0.0);
    float glow = exp(-behind / (uHalf * 14.0)) * reveal * (1.0 - smoothstep(0.15, 1.0, abs(vSide))) * uGlow;
    gl_FragColor = vec4(c.rgb + uColor * glow * 0.55, c.a);
  }
`

export function trailMaterial(color: string, length: number): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: {
      uColor: { value: new Color(color) },
      uInk: { value: new Color('#2a1a10') },
      uProgress: { value: 0 },
      uLength: { value: length },
      uHalf: { value: 4 },
      uFlow: { value: 0 },
      uOpacity: { value: 1 },
      uPx: { value: 1 },
      uGhost: { value: 0 },
      uGlow: { value: 1 },
    },
    transparent: true,
    depthWrite: false,
    // Premultiplied "over": ink where alpha is set, extra light where only colour is.
    blending: CustomBlending,
    blendEquation: AddEquation,
    blendSrc: OneFactor,
    blendDst: OneMinusSrcAlphaFactor,
    side: DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  })
}
