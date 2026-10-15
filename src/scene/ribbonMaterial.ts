import { AdditiveBlending, DoubleSide, NormalBlending, ShaderMaterial } from 'three'

/** Shared vertex shader of the ground ribbons: passes how far along the path, and which side, each vertex is. */
export const VERTEX = /* glsl */ `
  attribute float along;
  attribute float side;
  varying float vAlong;
  varying float vSide;
  void main() {
    vAlong = along;
    vSide = side;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

export type RibbonOptions = {
  /** Replaces the shared vertex shader (it must still fill `vAlong` and `vSide`). */
  vertexShader?: string
  /**
   * Paint over the ground instead of adding light to it: the fragment shader returns premultiplied colour, so one
   * pass can both cover (alpha) and glow (colour with no alpha). Additive light all but vanishes on pale parchment.
   */
  premultiplied?: boolean
}

export function ribbonMaterial(fragmentShader: string, uniforms: ShaderMaterial['uniforms'], options: RibbonOptions = {}): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: options.vertexShader ?? VERTEX,
    fragmentShader,
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: options.premultiplied ? NormalBlending : AdditiveBlending,
    premultipliedAlpha: options.premultiplied ?? false,
    side: DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  })
}
