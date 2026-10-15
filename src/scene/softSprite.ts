import { Sprite, SpriteMaterial, type Texture } from 'three'

export type Soft = { sprite: Sprite; push: { value: number } }

/**
 * A sprite that is drawn as if it were `push` world units farther from the camera, without moving on screen: the depth
 * test then lets the statues standing near the fire hide the haze behind them instead of being veiled by it.
 */
export function soft(map: Texture, order: number): Soft {
  const push = { value: 0 }
  const material = new SpriteMaterial({ map, transparent: true, depthWrite: false, toneMapped: false })
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uPush = push
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', 'uniform float uPush;\nvoid main() {')
      .replace('gl_Position = projectionMatrix * mvPosition;', 'mvPosition.xyz *= (mvPosition.z - uPush) / mvPosition.z;\n\tgl_Position = projectionMatrix * mvPosition;')
  }
  material.customProgramCacheKey = () => 'soft-sprite'
  const sprite = new Sprite(material)
  sprite.renderOrder = order
  sprite.visible = false
  return { sprite, push }
}

