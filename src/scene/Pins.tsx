import { useGLTF } from '@react-three/drei'
import { useMemo } from 'react'
import { GroundLabel } from './GroundLabel'
import { makeHeightIndex } from './heightIndex'
import { LABELS } from './labels'
import { PINS } from './places'
import { DRACO_PATH, FLOOR } from './sceneAssets'
import { useBoard } from './useBoard'

/**
 * The six named places: each name lies on the ground at the place's own spot (`GroundLabel`). There is no marker on the
 * terrain, only the lettering. Nothing here takes the pointer.
 */
export function Pins() {
  const { places } = useBoard()
  const { scene } = useGLTF(FLOOR.model, DRACO_PATH)
  const ground = useMemo(() => makeHeightIndex(scene), [scene])
  return (
    <>
      {PINS.map((pin) => {
        const at = places.get(pin.id)
        const spec = LABELS.find((l) => l.id === pin.id)
        if (!at || !spec) return null
        return <GroundLabel key={pin.id} spec={spec} at={at} ground={ground} />
      })}
    </>
  )
}
