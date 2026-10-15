import { useGLTF } from '@react-three/drei'
import { useLayoutEffect } from 'react'
import type { Material, Mesh } from 'three'
import { DRACO_PATH } from './sceneAssets'

/**
 * The glows (materials named `glow_*`) are soft alpha gradients that were tuned when the canvas blended them in
 * sRGB-encoded values. The post-processing blends in linear light, which spreads them wider; raising their alpha to
 * this power brings the falloff back (measured against the old canvas pixels: within a few levels at 2).
 */
export const GLOW_ALPHA_POWER = 2

const GLOW_MATERIAL = /^glow/i

export function tameGlow(material: Material) {
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `#include <map_fragment>\n  diffuseColor.a = pow(diffuseColor.a, ${GLOW_ALPHA_POWER.toFixed(2)});`,
    )
  }
  material.customProgramCacheKey = () => `glow-alpha-${GLOW_ALPHA_POWER}`
  material.needsUpdate = true
}

/** Renders a piece GLB exactly as exported: node transforms already hold the world positions. Flat markers pass `castShadow={false}`. */
export function Piece({ url, castShadow = true }: { url: string; castShadow?: boolean }) {
  const { scene } = useGLTF(url, DRACO_PATH)
  useLayoutEffect(() => {
    scene.traverse((o) => {
      const mesh = o as Mesh
      if (!mesh.isMesh) return
      mesh.castShadow = castShadow
      mesh.receiveShadow = castShadow
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        if (GLOW_MATERIAL.test(material.name)) tameGlow(material)
      }
    })
  }, [scene, castShadow])
  return <primitive object={scene} />
}
