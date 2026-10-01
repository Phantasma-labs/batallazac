import { MapControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef, type ComponentRef } from 'react'
import { Vector3, type PerspectiveCamera } from 'three'
import {
  MAX_POLAR_DEG,
  MIN_DISTANCE,
  MIN_POLAR_DEG,
  VFOV_DEG,
  clampCameraHeight,
  clampTarget,
  defaultFraming,
  fitDistance,
  maxDistanceFor,
  panVector,
  type Bounds,
} from './math'
import { useKeyboardPan } from './useKeyboardPan'

const rad = (deg: number) => (deg * Math.PI) / 180
const MAX_FRAME_DT = 0.1 // a tab coming back from the background must not teleport the camera
const heading = new Vector3()

export function MapCamera({ bounds }: { bounds: Bounds }) {
  const camera = useThree((s) => s.camera)
  const get = useThree((s) => s.get)
  const controls = useRef<ComponentRef<typeof MapControls>>(null)
  const keys = useKeyboardPan()
  const maxDistance = useMemo(() => maxDistanceFor(bounds), [bounds])

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
    // The far plane must always reach the whole board from the farthest allowed zoom.
    const persp = camera as PerspectiveCamera
    persp.far = Math.max(persp.far, maxDistance * 2.5)
    persp.updateProjectionMatrix()
    // Dev-only hook for manual checks; `advance` steps the frame loop when the tab is not being painted.
    if (import.meta.env.DEV) Object.assign(window, { __map: { camera, controls: controls.current, bounds, advance: get().advance } })
  }, [camera, framing, bounds, get, maxDistance])

  // Runs after drei's controls.update() (priority -1), so we adjust the final state each frame.
  useFrame((_, delta) => {
    const c = controls.current
    if (!c) return

    camera.getWorldDirection(heading)
    const distance = camera.position.distanceTo(c.target)
    const step = panVector(keys.current, { x: heading.x, z: heading.z }, distance, Math.min(delta, MAX_FRAME_DT))
    c.target.x += step.x
    c.target.z += step.z
    camera.position.x += step.x
    camera.position.z += step.z

    // Keep the target on the board; move the camera by the same amount so the view just stops at the edge.
    const clamped = clampTarget(c.target, bounds)
    camera.position.x += clamped.x - c.target.x
    camera.position.y += clamped.y - c.target.y
    camera.position.z += clamped.z - c.target.z
    c.target.set(clamped.x, clamped.y, clamped.z)

    // Never let the camera sink into the terrain, whatever relief the loaded floor has.
    camera.position.y = clampCameraHeight(camera.position.y, bounds)
  })

  return (
    <MapControls
      ref={controls}
      makeDefault
      screenSpacePanning={false}
      minDistance={MIN_DISTANCE}
      maxDistance={maxDistance}
      minPolarAngle={rad(MIN_POLAR_DEG)}
      maxPolarAngle={rad(MAX_POLAR_DEG)}
    />
  )
}
