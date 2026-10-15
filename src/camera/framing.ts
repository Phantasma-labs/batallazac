import { useGLTF } from '@react-three/drei'
import { useMemo } from 'react'
import { Box3 } from 'three'
import { DRACO_PATH, FLOOR, PIECES } from '../scene/sceneAssets'
import { floorLayout } from './locked'
import { insetCorners, type Vec3 } from './math'

/**
 * How the loaded floor's board differs from the original one (stretch factor, moved hotspots), as recorded in
 * the floor file itself. Reading it from the asset means the floor, the pieces and the hotspots can never
 * disagree about the layout. See `floorLayout`.
 */
export function useFloorLayout(): { stretch: number; shifts: Record<string, number> } {
  const { scene } = useGLTF(FLOOR.model, DRACO_PATH)
  return useMemo(() => floorLayout(scene.userData), [scene])
}

/** Pieces the opening view must show: the compass sits in a corner that fitting the board width crops. */
const FRAMED_PIECES = ['compass']
const URLS = PIECES.filter((p) => FRAMED_PIECES.includes(p.id)).map((p) => p.url)

/** The compass art has a transparent margin, so only the inner part of its quad has to stay in view. */
const FRAMED_INSET = 0.1

/**
 * Corners of the framed pieces' bounding boxes (inset by FRAMED_INSET), read from the loaded models so that a
 * compass moved in Blender and re-exported re-frames itself. The result only changes when a model does, so memoised
 * consumers (the cameras) do not reset the view on an ordinary re-render.
 */
export function useFramedPoints(): Vec3[] {
  const scenes = useGLTF(URLS, DRACO_PATH).map((g) => g.scene)
  return useMemo(
    () =>
      scenes.flatMap((scene) => {
        scene.updateWorldMatrix(true, true)
        return insetCorners(new Box3().setFromObject(scene), FRAMED_INSET)
      }),
    scenes, // a fresh array every render, but its contents (the loaded models) are the identity
  )
}
