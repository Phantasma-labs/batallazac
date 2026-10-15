import { Color, type ShaderMaterial } from 'three'
import { ribbonMaterial } from './ribbonMaterial'

/**
 * A shell in flight, seen from the side: a hot white head with a rounded nose, a lane-coloured core, and an ink-dark
 * smoke trail round it that carries the streak on pale parchment, where light alone would vanish. `vAlong` is 0 at the
 * tail and 1 at the head; `vSide` is across the streak.
 */
const TRACER_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uAlpha;
  varying float vAlong;
  varying float vSide;
  vec3 out3(vec3 c) { return linearToOutputTexel(vec4(c, 1.0)).rgb; }
  void main() {
    float across = abs(vSide);
    // Round off the head: the quad's end is a hard cut.
    float nose = vAlong > 0.8 ? sqrt(max(1.0 - pow((vAlong - 0.8) / 0.2, 2.0), 0.0)) : 1.0;
    float smoke = smoothstep(0.0, 0.7, vAlong) * (1.0 - smoothstep(0.7, 1.0, across)) * nose * 0.85;
    float core = pow(vAlong, 1.3) * (1.0 - smoothstep(0.5, 0.75, across)) * nose;
    float heat = smoothstep(0.7, 1.0, vAlong) * (1.0 - smoothstep(0.0, 0.5, across));
    vec3 smokeCol = out3(vec3(0.07, 0.04, 0.025));
    vec3 coreCol = out3(mix(uColor, vec3(1.0, 0.5, 0.12), 0.5));
    vec3 hotCol = out3(vec3(1.0, 0.96, 0.8));
    vec3 col = mix(coreCol, hotCol, heat);
    float a = core + smoke * (1.0 - core);
    vec3 rgb = col * core + smokeCol * smoke * (1.0 - core);
    gl_FragColor = vec4(rgb, a) * uAlpha;
  }
`

export function tracerMaterial(color: string): ShaderMaterial {
  return ribbonMaterial(TRACER_FRAGMENT, { uColor: { value: new Color(color) }, uAlpha: { value: 1 } }, { premultiplied: true })
}
