import { useGLTF, useTexture } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useLayoutEffect } from 'react'
import { Box3, SRGBColorSpace, type Mesh, type MeshStandardMaterial } from 'three'
import { boundsFromBox, type Bounds } from '../camera/math'
import { DRACO_PATH, FLOOR } from './sceneAssets'

/**
 * The baked floor mesh with its base colour texture. Shape-agnostic on purpose: it reads the
 * loaded geometry's bounds rather than assuming a size, so a re-exported floor just works.
 */
export function Terrain({ onBounds }: { onBounds: (bounds: Bounds) => void }) {
  const { scene } = useGLTF(FLOOR.model, DRACO_PATH)
  const basecolor = useTexture(FLOOR.basecolor)
  const maxAnisotropy = useThree((s) => s.gl.capabilities.getMaxAnisotropy())

  useLayoutEffect(() => {
    basecolor.colorSpace = SRGBColorSpace
    basecolor.flipY = false // glTF UVs are already top-left
    basecolor.anisotropy = maxAnisotropy
    basecolor.needsUpdate = true
    scene.traverse((o) => {
      const mesh = o as Mesh
      if (!mesh.isMesh) return
      for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        ;(m as MeshStandardMaterial).map = basecolor
        m.needsUpdate = true
      }
    })
    scene.updateWorldMatrix(true, true)
    try {
      onBounds(boundsFromBox(new Box3().setFromObject(scene)))
    } catch (err) {
      // An export with no mesh (wrong selection in Blender) must say so, not leave a blank canvas.
      throw new Error(`${FLOOR.model}: ${(err as Error).message}. Select the floor mesh in Blender and export again.`)
    }
  }, [scene, basecolor, maxAnisotropy, onBounds])

  return <primitive object={scene} />
}
