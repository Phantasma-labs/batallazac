import { useGLTF } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useLayoutEffect } from 'react'
import { Box3, type Mesh, type MeshStandardMaterial } from 'three'
import { boundsFromBox, type Bounds } from '../camera/math'
import { DRACO_PATH, FLOOR } from './sceneAssets'

/**
 * The floor: terrain plus the wooden frame, with its textures embedded in the GLB. Shape-agnostic on
 * purpose: it reads the loaded geometry's bounds rather than assuming a size, so a re-exported floor
 * just works. It must not overwrite the GLB's own materials (the frame is a different material).
 */
export function Terrain({ onBounds }: { onBounds: (bounds: Bounds) => void }) {
  const { scene } = useGLTF(FLOOR.model, DRACO_PATH)
  const maxAnisotropy = useThree((s) => s.gl.capabilities.getMaxAnisotropy())

  useLayoutEffect(() => {
    // Sharpen the embedded textures at grazing angles; nothing else about the materials is touched.
    scene.traverse((o) => {
      const mesh = o as Mesh
      if (!mesh.isMesh) return
      for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        const map = (m as MeshStandardMaterial).map
        if (map) {
          map.anisotropy = maxAnisotropy
          map.needsUpdate = true
        }
      }
    })
    scene.updateWorldMatrix(true, true)
    try {
      onBounds(boundsFromBox(new Box3().setFromObject(scene)))
    } catch (err) {
      // An export with no mesh (wrong selection in Blender) must say so, not leave a blank canvas.
      throw new Error(`${FLOOR.model}: ${(err as Error).message}. Select the floor mesh in Blender and export again.`)
    }
  }, [scene, maxAnisotropy, onBounds])

  return <primitive object={scene} />
}
