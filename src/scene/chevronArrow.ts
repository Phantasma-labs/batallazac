import { Color, Vector2, type ShaderMaterial } from 'three'
import { ARROW_VERTEX, hotOf, inkOf } from './arrowGlow'
import type { HeightMap } from './heightMap'
import { ribbonMaterial } from './ribbonMaterial'

/** The chevron's width (across the arrow) as a share of the viewport's height, the most it is in world units, and the spacing of the chevrons against their width. */
export const CHEVRON_SCREEN = 0.086
export const MAX_CHEVRON = 73
export const CHEVRON_SPACING = 1.75
/** Chevrons travel toward the target at this many spacings a second (effects time, so they stand still while the clock is paused). */
export const CHEVRON_SPEED = 0.35
/** An arrow shows at least this many chevron widths of itself, so a short one gets small chevrons rather than none; and none is thinner than this (world units). */
export const MIN_ARROW_WIDTHS = 3
export const MIN_CHEVRON = 8

/**
 * The chevron's width in world units: the same share of the screen in a wide and a medium shot, never more than `MAX_CHEVRON` (a
 * chevron that big would swallow a hill) nor more than a third of the arrow (or a short arrow would be no chevron at all).
 */
export function chevronWidth(worldPerPixel: number, viewportHeight: number, length: number): number {
  const most = Math.min(MAX_CHEVRON, length / MIN_ARROW_WIDTHS)
  return Math.min(Math.max(worldPerPixel * CHEVRON_SCREEN * viewportHeight, Math.min(MIN_CHEVRON, most)), most)
}
/** Centre to centre along the arrow. */
export const chevronPeriod = (width: number) => width * CHEVRON_SPACING

type P = [number, number]

/**
 * The outline of one chevron for a width (across the arrow) of 1, as (along, across) with +along toward the target and the middle of
 * its length at 0: a tip, two arms of one thickness swept back from it with square ends, and the notch between them.
 * Six points; the shader takes the distance to this polygon, so the edges are clean at any size.
 */
export function chevronOutline(): P[] {
  const run = 0.56 // how far back an arm's centre line reaches from the tip
  const spread = 0.5 // and how far out
  const thick = 0.34 // thickness of an arm
  const len = Math.hypot(run, spread)
  const sin = spread / len, cos = run / len
  // The arm's normal on its outer side (toward the target and out), and the tip and notch where the two arms meet on the axis.
  const n: P = [sin, cos]
  const tip = thick / 2 / sin
  const end: P = [-run, spread]
  const top: P[] = [
    [end[0] + (n[0] * thick) / 2, end[1] + (n[1] * thick) / 2],
    [end[0] - (n[0] * thick) / 2, end[1] - (n[1] * thick) / 2],
  ]
  const raw: P[] = [[tip, 0], top[0], top[1], [-tip, 0], [top[1][0], -top[1][1]], [top[0][0], -top[0][1]]]
  const width = 2 * top[0][1]
  const back = Math.min(...raw.map((p) => p[0]))
  const shift = (back + tip) / 2
  return raw.map(([a, b]) => [(a - shift) / width, b / width])
}

/** The vertex shader is the arrow's (the strip is draped on the terrain through the height map); the chevrons are drawn in the fragment shader. */
const OUTLINE = chevronOutline()
const CHEVRON_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uHot;
  uniform vec3 uInk;
  uniform float uGeom;
  uniform float uBody;
  uniform float uPhase;
  uniform float uOpacity;
  uniform float uStrength;
  uniform float uS0;
  uniform float uS1;
  varying float vAlong;
  varying float vSide;

  const vec2 V[6] = vec2[6](${OUTLINE.map(([a, b]) => `vec2(${a.toFixed(5)}, ${b.toFixed(5)})`).join(', ')});

  // Signed distance to the chevron (negative inside) for a width of 1.
  float sdChevron(vec2 p) {
    float d = dot(p - V[0], p - V[0]);
    float s = 1.0;
    for (int i = 0, j = 5; i < 6; j = i, i++) {
      vec2 e = V[j] - V[i];
      vec2 w = p - V[i];
      vec2 b = w - e * clamp(dot(w, e) / dot(e, e), 0.0, 1.0);
      d = min(d, dot(b, b));
      bvec3 c = bvec3(p.y >= V[i].y, p.y < V[j].y, e.x * w.y > e.y * w.x);
      if (all(c) || all(not(c))) s *= -1.0;
    }
    return s * sqrt(d);
  }

  // The colours are in linear light like every other material, so convert each layer before it is premultiplied.
  vec3 out3(vec3 c) { return linearToOutputTexel(vec4(c, 1.0)).rgb; }

  void main() {
    float width = uBody;
    float period = width * ${CHEVRON_SPACING.toFixed(3)};
    float s = vAlong;
    float y = vSide * uGeom;

    // The chevrons stand a period apart along the path and drift toward the target; each is drawn in its own cell.
    float cell = floor(s / period - uPhase);
    float centre = (cell + uPhase + 0.5) * period;
    float d = sdChevron(vec2(s - centre, y) / width) * width;
    float px = max(fwidth(d), 1e-4);
    float dp = d / px;
    float inside = 1.0 - smoothstep(-0.8, 0.8, dp);

    // Whole chevrons come in at the tail and are spent at the tip, as the arrow grows out to the target and is drawn back in.
    float env = smoothstep(uS0, uS0 + 0.9 * period, centre) * (1.0 - smoothstep(uS1 - 0.9 * period, uS1 - 0.1 * period, centre));
    float fade = smoothstep(0.0, 0.4, uStrength);

    // A thin shaft joins them, so the chevrons read as one arrow.
    float shaftEnv = smoothstep(uS0, uS0 + 0.5 * period, s) * (1.0 - smoothstep(uS1 - 0.5 * period, uS1, s));
    float shaft = (1.0 - smoothstep(0.045 * width, 0.045 * width + px, abs(y))) * shaftEnv * 0.55;

    vec3 body = mix(uColor, uHot, 0.25);
    float aBody = inside * env * uOpacity * fade;
    float aShaft = shaft * uOpacity * fade;
    float a = aBody + aShaft * (1.0 - aBody);
    vec3 rgb = out3(body) * aBody + out3(uColor) * aShaft * (1.0 - aBody);
    // A thin dark edge, so a chevron holds on pale parchment as well as on the dark hatching.
    float ink = (1.0 - smoothstep(0.5, 1.8, abs(dp + 0.9))) * 0.6 * env * uOpacity * fade;
    rgb = out3(uInk) * ink + rgb * (1.0 - ink);
    a = ink + a * (1.0 - ink);
    // Light spilling on the ground round them, added (no alpha).
    float spill = exp(-max(d, 0.0) / (0.3 * width)) * env * 0.3 * fade;
    gl_FragColor = vec4(rgb + out3(uHot) * spill * (1.0 - a), a);
  }
`

/** The chevrons' paint: a stronger, brighter shade of each lane's colour (the lane's own is the trail's and the flag's), so they read on the dark hatching and the pale parchment alike. */
export const CHEVRON_PAINT: Record<string, string> = { angeles: '#ff4636', villa: '#ff4636', federal: '#5fa0ff' }

/** The chevron arrow of an attack, in `color`. */
export function chevronMaterial(color: string, height: HeightMap): ShaderMaterial {
  const base = new Color(color)
  return ribbonMaterial(
    CHEVRON_FRAGMENT,
    {
      uColor: { value: base },
      uHot: { value: hotOf(base) },
      uInk: { value: inkOf(base) },
      uGeom: { value: 1 },
      uBody: { value: 1 },
      uRaise: { value: 0 },
      uPhase: { value: 0 },
      uOpacity: { value: 1 },
      uStrength: { value: 0 },
      uS0: { value: 0 },
      uS1: { value: 1 },
      // Read by the shared vertex shader (the arrow's contact shadow, which the chevrons do not have).
      uLight: { value: new Vector2(0, 1) },
      uShadowOffset: { value: 0 },
      uHeight: { value: height.texture },
      uBox: { value: height.box },
    },
    { vertexShader: ARROW_VERTEX, premultiplied: true },
  )
}
