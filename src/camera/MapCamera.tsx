import { MapControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef, type ComponentRef } from 'react'
import {
  MAX_DISTANCE,
  MAX_POLAR_DEG,
  MIN_DISTANCE,
  MIN_POLAR_DEG,
  VFOV_DEG,
  defaultFraming,
  fitDistance,
  type Bounds,
} from './math'

const rad = (deg: number) => (deg * Math.PI) / 180

export function MapCamera({ bounds }: { bounds: Bounds }) {
  const camera = useThree((s) => s.camera)
  const get = useThree((s) => s.get)
  const controls = useRef<ComponentRef<typeof MapControls>>(null)

  // Framed once per terrain. Reading the size via get() (not a subscription) means a window
  // resize does not reset the user's view.
  const framing = useMemo(() => {
    const { width, height } = get().size
    return defaultFraming(bounds, fitDistance(bounds, VFOV_DEG, width / height))
  }, [bounds, get])

  useLayoutEffect(() => {
    const { target, position } = framing
    camera.position.set(position.x, position.y, position.z)
    camera.lookAt(target.x, target.y, target.z)
    controls.current?.target.set(target.x, target.y, target.z)
    controls.current?.update()
  }, [camera, framing])

  return (
    <MapControls
      ref={controls}
      makeDefault
      screenSpacePanning={false}
      minDistance={MIN_DISTANCE}
      maxDistance={MAX_DISTANCE}
      minPolarAngle={rad(MIN_POLAR_DEG)}
      maxPolarAngle={rad(MAX_POLAR_DEG)}
    />
  )
}
