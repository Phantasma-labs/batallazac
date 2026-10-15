import { useGLTF } from '@react-three/drei'
import { useMemo } from 'react'
import type { Object3D } from 'three'
import { heightFieldOf, type HeightField } from './heightField'
import { DRACO_PATH, FLOOR } from './sceneAssets'

const cache = new WeakMap<Object3D, HeightField>()

/** The floor's height field, built once (a few tens of milliseconds) and shared by every formation and trail. */
export function useHeightField(): HeightField {
  const { scene } = useGLTF(FLOOR.model, DRACO_PATH)
  return useMemo(() => {
    let field = cache.get(scene)
    if (!field) {
      field = heightFieldOf(scene)
      cache.set(scene, field)
    }
    return field
  }, [scene])
}
