import { Color, DoubleSide, PlaneGeometry, ShaderMaterial } from 'three'

/** The guidon's size in model units: from the pole to the tips of the swallowtail, and top to bottom. */
export const CLOTH = { w: 66, h: 37, notch: 0.26 }
const INK = '#2a1a10'

/** A grid hanging from the pole (at x = 0) toward -X; the waving is done in the vertex shader. */
export function clothGeometry(): PlaneGeometry {
  return new PlaneGeometry(CLOTH.w, CLOTH.h, 28, 10).translate(-CLOTH.w / 2, 0, 0)
}

const VERTEX = /* glsl */ `
  uniform float uPhase;
  varying vec2 vCloth;
  varying float vShade;
  void main() {
    float away = -position.x;
    float free = away / ${CLOTH.w.toFixed(1)};
    float ph = away * 0.15 - uPhase;
    vec3 p = position;
    p.z += sin(ph) * 3.2 * free;
    vShade = cos(ph) * free;
    vCloth = vec2(away, position.y);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`

/** Cuts the swallowtail out of the grid and inks the border, so the cloth is outlined like the blocks under it. */
const FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uInk;
  varying vec2 vCloth;
  varying float vShade;
  void main() {
    float hh = ${(CLOTH.h / 2).toFixed(2)};
    float n = ${(CLOTH.notch * CLOTH.w).toFixed(2)};
    float edge = ${CLOTH.w.toFixed(1)} - n * (1.0 - abs(vCloth.y) / hh);
    float dNotch = (edge - vCloth.x) / sqrt(1.0 + (n / hh) * (n / hh));
    float d = min(hh - abs(vCloth.y), dNotch);
    if (d < 0.0) discard;
    float border = 1.0 - smoothstep(1.1, 2.0, d);
    vec3 cloth = uColor * (1.12 + 0.2 * vShade) + vec3(0.1 * vCloth.y / hh);
    gl_FragColor = vec4(mix(cloth, uInk, border), 1.0);
  }
`

export function clothMaterial(color: string): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: { uPhase: { value: 0 }, uColor: { value: new Color(color) }, uInk: { value: new Color(INK) } },
    side: DoubleSide,
  })
}
