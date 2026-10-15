import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { AdditiveBlending, DoubleSide, Mesh, MeshBasicMaterial, RingGeometry, Sprite, SpriteMaterial, type PerspectiveCamera } from 'three'
import { clock } from '../timeline/clock'
import { EVENTS } from '../timeline/events'
import { activeBlasts, type Blast as BlastData } from '../timeline/model'
import { glowTexture } from './effectTextures'
import { Impact } from './Impact'
import { EXPLOSION, blastLook, effectUnit, seedOf } from './impactEffect'
import { worldPerPixel } from './screenScale'
import type { LiveAttack } from './Tracers'
import type { Board } from './useBoard'

/** The shock ring's radius at full spread, and the fireball's size at its peak, in effect units (see `effectUnit`). */
const RING_RADIUS = 3.6
const BLOOM_SIZE = 7
/** The ring lies this far above the terrain, so the city's slopes do not cut it. */
const RING_LIFT = 2
/** Drawn after the ground glows and trails (3), before the forces (6) and their flags (7), so a unit never hides under the bang. */
const RING_ORDER = 5
const BLOOM_ORDER = 7

/**
 * One explosion on the timeline (`blasts` of an event): at the bang a white-hot fireball swells and a shock ring races out over the
 * ground, then a dense column of smoke and fire keeps burning over the place (the existing `Impact`, with the big `EXPLOSION` kind)
 * until the blast's end, thinning out over the last minutes. The bang follows the clock, so scrubbing plays it forward and back.
 */
export function Blast({ blast, board }: { blast: BlastData; board: Board }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const height = useThree((s) => s.size.height)
  const place = useMemo(() => board.places.get(blast.at)!, [board, blast])
  const seed = useMemo(() => seedOf(`blast>${blast.at}`), [blast])
  const live = useRef<LiveAttack>({ strength: 0, from: place, to: place })

  const parts = useMemo(() => {
    const bloom = new Sprite(new SpriteMaterial({ map: glowTexture(), transparent: true, depthWrite: false, depthTest: false, blending: AdditiveBlending, toneMapped: false }))
    bloom.renderOrder = BLOOM_ORDER
    bloom.visible = false
    const geometry = new RingGeometry(0.9, 1, 96)
    geometry.rotateX(-Math.PI / 2)
    const material = new MeshBasicMaterial({ color: '#ffe6b8', transparent: true, depthWrite: false, depthTest: false, blending: AdditiveBlending, side: DoubleSide, toneMapped: false })
    const ring = new Mesh(geometry, material)
    ring.renderOrder = RING_ORDER
    ring.frustumCulled = false
    ring.visible = false
    ring.raycast = () => null
    return { bloom, ring, geometry, material }
  }, [])
  useEffect(
    () => () => {
      parts.geometry.dispose()
      parts.material.dispose()
      parts.bloom.material.dispose()
    },
    [parts],
  )

  useFrame(() => {
    const now = activeBlasts(EVENTS, clock.time).find((b) => b.blast === blast)
    live.current.strength = now ? now.strength : 0
    live.current.from = place
    live.current.to = place
    const { bloom, ring, material } = parts
    const look = now ? blastLook(now.age) : null
    bloom.visible = !!look && look.bloom > 0.01
    ring.visible = !!look && look.ring > 0.01
    if (!look) return
    const U = effectUnit(worldPerPixel(camera, place, height))
    if (bloom.visible) {
      bloom.position.set(place.x, place.y + 0.5 * U, place.z)
      bloom.scale.setScalar(U * (1.5 + BLOOM_SIZE * look.bloom))
      bloom.material.opacity = Math.min(look.bloom * 1.15, 1)
    }
    if (ring.visible) {
      const r = Math.max(U * RING_RADIUS * look.spread, 1)
      ring.position.set(place.x, place.y + RING_LIFT, place.z)
      ring.scale.set(r, 1, r)
      material.opacity = look.ring * 0.75
    }
  })

  return (
    <>
      <Impact live={live} kind={EXPLOSION} fire="#ff8a2a" seed={seed} />
      <primitive object={parts.ring} />
      <primitive object={parts.bloom} />
    </>
  )
}
