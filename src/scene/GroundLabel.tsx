import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { BufferAttribute, BufferGeometry, CanvasTexture, DoubleSide, SRGBColorSpace, type Mesh, type MeshBasicMaterial, type PerspectiveCamera } from 'three'
import { shot } from '../camera/shot'
import { drawLabel } from './labelTexture'
import { capFraction, groundTextAlpha, labelBoost, labelCenter, labelGrid, pxPerUnit, type LabelSpec } from './labels'

/** Share of the ink that shows: near-opaque, so that no hatching or glow behind the name can ghost it. */
const OPACITY = 0.93
/** World units between the terrain and the text, so the hills' slopes do not cut it. */
const LIFT = 2.2
/** Spacing of the grid that is laid over the terrain: fine enough for the text to follow the hills. */
const GRID_STEP = 7
/**
 * Drawn after the trails, arrows, glows and flag halos (render orders 2 to 5), and without a depth test, so that nothing
 * glowing washes over a name and no formation, flag or statue that stops on it can hide it: a name must always be readable.
 */
const RENDER_ORDER = 8

/**
 * A place name lying on the ground in perspective, directly below its marker: a grid of the label's size, its vertices raised
 * onto the terrain, with the name drawn on it (see `labelTexture.ts`). In the wide shot it is always fully shown; it fades only if the lens
 * zooms so far in that it would swamp the shot. No pointer events: clicks reach the canvas.
 */
export function GroundLabel({
  spec,
  at,
  ground,
}: {
  spec: LabelSpec
  at: { x: number; z: number }
  ground: (x: number, z: number) => number
}) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const height = useThree((s) => s.size.height)
  const maxAnisotropy = useThree((s) => s.gl.capabilities.getMaxAnisotropy())
  const mesh = useRef<Mesh>(null)

  const label = useMemo(() => {
    const drawn = drawLabel(spec)
    const w = drawn.width * drawn.worldPerPx
    const h = drawn.height * drawn.worldPerPx
    const centre = labelCenter(at, drawn.block * drawn.worldPerPx, spec.shift, spec.rise)
    // The text hangs below the pin, centred (or shifted aside), always level: it no longer leans with the hill's ridge.
    const grid = labelGrid(centre, w, h, 0, GRID_STEP)
    const positions = new Float32Array((grid.xz.length / 2) * 3)
    for (let i = 0; i < grid.xz.length / 2; i++) {
      const x = grid.xz[i * 2]
      const z = grid.xz[i * 2 + 1]
      positions.set([x, ground(x, z) + LIFT, z], i * 3)
    }
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(positions, 3))
    geometry.setAttribute('uv', new BufferAttribute(grid.uv, 2))
    geometry.setIndex(new BufferAttribute(grid.index, 1))
    geometry.computeBoundingSphere()
    const texture = new CanvasTexture(drawn.canvas)
    texture.colorSpace = SRGBColorSpace
    texture.anisotropy = maxAnisotropy // the ground is seen at a grazing angle
    return { geometry, texture, cap: spec.fadeCap ?? spec.cap, centre: { x: centre.x, y: ground(centre.x, centre.z), z: centre.z } }
  }, [spec, at, ground, maxAnisotropy])

  useEffect(() => () => { label.geometry.dispose(); label.texture.dispose() }, [label])

  useFrame(() => {
    const m = mesh.current
    if (!m) return
    const d = Math.hypot(label.centre.x - camera.position.x, label.centre.y - camera.position.y, label.centre.z - camera.position.z)
    const alpha = groundTextAlpha(capFraction(label.cap, d, camera.fov, shot.wideFov))
    m.visible = alpha > 0.01
    ;(m.material as MeshBasicMaterial).opacity = alpha * OPACITY
    // On a smaller window the board is smaller on screen, so the lettering is enlarged on the ground (about its own centre).
    const boost = labelBoost(pxPerUnit(d, camera.fov, height))
    m.scale.set(boost, 1, boost)
    m.position.set(label.centre.x * (1 - boost), 0, label.centre.z * (1 - boost))
  })

  return (
    <mesh ref={mesh} geometry={label.geometry} renderOrder={RENDER_ORDER} frustumCulled={false} raycast={() => null}>
      <meshBasicMaterial
        map={label.texture}
        transparent
        opacity={OPACITY}
        depthTest={false}
        depthWrite={false}
        side={DoubleSide}
        toneMapped={false}
      />
    </mesh>
  )
}
