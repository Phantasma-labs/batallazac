import { useGLTF } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo } from 'react'
import { Box3, TextureLoader, Vector3, type Mesh, type MeshStandardMaterial, type Object3D } from 'three'
import { boundsFromBox, lowestRimY, type Bounds } from '../camera/math'
import { bumpScaleFromSearch, floorNormalMapUrl } from './bump'
import { DRACO_PATH, FLOOR } from './sceneAssets'

const BUMP_SCALE = bumpScaleFromSearch(window.location.search) // ?bump=off or ?bump=1.2

/** Every vertex of every mesh under `root`, as flat world-space x, y, z values. */
function worldVertices(root: Object3D): number[] {
  const out: number[] = []
  const v = new Vector3()
  root.traverse((o) => {
    const mesh = o as Mesh
    const pos = mesh.isMesh ? mesh.geometry.getAttribute('position') : undefined
    if (!pos) return
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld)
      out.push(v.x, v.y, v.z)
    }
  })
  return out
}

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
      mesh.receiveShadow = true
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
      const bounds = boundsFromBox(new Box3().setFromObject(scene))
      onBounds({ ...bounds, rimY: lowestRimY(worldVertices(scene), bounds) })
    } catch (err) {
      // An export with no mesh (wrong selection in Blender) must say so, not leave a blank canvas.
      throw new Error(`${FLOOR.model}: ${(err as Error).message}. Select the floor mesh in Blender and export again.`)
    }
  }, [scene, maxAnisotropy, onBounds])

  // The bump: the floor file names a normal map made from the painting (see bump.ts). A missing file just means no bump.
  const normalUrl = useMemo(() => floorNormalMapUrl(scene.userData), [scene])
  useEffect(() => {
    if (!normalUrl || BUMP_SCALE <= 0) return
    const floorMaterials: MeshStandardMaterial[] = []
    scene.traverse((o) => {
      const mesh = o as Mesh
      if (!mesh.isMesh) return
      for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        if ((m as MeshStandardMaterial).map) floorMaterials.push(m as MeshStandardMaterial)
      }
    })
    let cancelled = false
    const texture = new TextureLoader().load(
      normalUrl,
      (t) => {
        if (cancelled) return
        t.flipY = false // glTF convention, like the embedded colour map, so the two share their UVs
        t.anisotropy = maxAnisotropy
        for (const m of floorMaterials) {
          m.normalMap = t
          // The terrain has no tangents, so three derives them from the UVs; the glTF loader flips the green channel in
          // that case and so do we.
          m.normalScale.set(BUMP_SCALE, -BUMP_SCALE)
          m.needsUpdate = true
        }
      },
      undefined,
      () => console.warn(`${normalUrl}: not found; the floor has no bump`),
    )
    return () => {
      cancelled = true
      for (const m of floorMaterials) {
        if (m.normalMap === texture) m.normalMap = null
        m.needsUpdate = true
      }
      texture.dispose()
    }
  }, [scene, normalUrl, maxAnisotropy])

  return <primitive object={scene} />
}
