import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { BufferAttribute, BufferGeometry, type Mesh, type PerspectiveCamera } from 'three'
import { clock } from '../timeline/clock'
import { marchProgress, pointAlong, type ResolvedMarch } from '../timeline/model'
import { LIFT } from './marchShared'
import { worldPerPixel } from './screenScale'
import { GLOW_REACH, trailMaterial } from './trailGlow'
import { buildTrailRibbon, trailHalfWidth } from './trailRibbon'
import { useHeightField } from './useHeightField'

/** Half the width of a dash's strip on screen, in pixels on a 768 px high view. */
const HALF_PIXELS = 7
/** The widest the strip gets, where its heights are sampled. */
const MAX_HALF = 9
/** Minutes before a march starts when its route first shows (faintly), so the viewer sees where the unit is about to go. */
const PREVIEW_MINUTES = 20
/** How strongly a finished march's trail still shows. */
const DONE_OPACITY = 0.62

/**
 * The trail of one march: inked dashes in the unit's colour laid on the ground, shown from the start of the path up to the
 * unit's progress and staying (dimmer) once the march is over. While it is on, the unit's route ahead shows as faint dots, and the
 * dashes drift toward the destination. The strip keeps its width on screen as the lens zooms (within limits).
 */
export function Trail({ march, color }: { march: ResolvedMarch; color: string }) {
  const ground = useHeightField()
  const geometry = useMemo(() => {
    const r = buildTrailRibbon(march.path, ground, MAX_HALF * GLOW_REACH, LIFT)
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(r.positions, 3))
    g.setAttribute('across', new BufferAttribute(r.across, 2))
    g.setAttribute('along', new BufferAttribute(r.along, 1))
    g.setAttribute('side', new BufferAttribute(r.side, 1))
    g.setIndex(new BufferAttribute(r.index, 1))
    g.userData.length = r.length
    return g
  }, [march, ground])
  const material = useMemo(() => trailMaterial(color, geometry.userData.length as number), [color, geometry])
  const middle = useMemo(() => pointAlong(march.path, 0.5), [march])
  const mesh = useRef<Mesh>(null)
  const flow = useRef(0)
  useEffect(() => () => { geometry.dispose(); material.dispose() }, [geometry, material])

  useFrame((state, delta) => {
    const t = clock.time
    const m = mesh.current
    if (m) m.visible = t >= march.start - PREVIEW_MINUTES
    if (!m?.visible) return
    const progress = marchProgress(march, t)
    const walking = t >= march.start && t < march.end
    const wpp = worldPerPixel(state.camera as PerspectiveCamera, middle, state.size.height)
    const u = material.uniforms
    u.uHalf.value = trailHalfWidth(wpp, (HALF_PIXELS * state.size.height) / 768, 1.8, MAX_HALF)
    u.uPx.value = wpp
    // The dashes drift toward the destination while the unit walks.
    if (walking && clock.playing) flow.current += delta * 5
    u.uFlow.value = flow.current
    u.uProgress.value = progress >= 1 ? 1.02 : progress
    u.uOpacity.value = progress >= 1 ? DONE_OPACITY : t < march.start ? 0 : 1
    u.uGhost.value = progress < 1 ? Math.min(1, Math.max(0, (t - (march.start - PREVIEW_MINUTES)) / 6)) : 0
    u.uGlow.value = progress >= 1 ? 0.35 : 1
  })
  return <mesh ref={mesh} geometry={geometry} material={material} frustumCulled={false} renderOrder={2} visible={false} />
}
