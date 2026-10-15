import { fx } from '../timeline/fxTime'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import { BufferAttribute, BufferGeometry, type Mesh, type PerspectiveCamera, type ShaderMaterial } from 'three'
import { attackLine } from '../timeline/attack'
import { clock } from '../timeline/clock'
import { EVENTS, UNITS } from '../timeline/events'
import { activeAttacks, unitPosition, type ResolvedMarch } from '../timeline/model'
import { arrowOutline, arrowSpan, arrowStrip, bodyOpacity, bodyWidth, bowAmount, bowedPlan, lateralColumns, longness, resamplePlan } from './arrowShape'
import { arrowMaterial } from './arrowGlow'
import { CHEVRON_PAINT, CHEVRON_SPEED, chevronMaterial, chevronWidth } from './chevronArrow'
import { useHeightField } from './useHeightField'
import { useHeightMap } from './heightMap'
import { GUN_MUZZLES, muzzleKey } from './gunFire'
import { Impact } from './Impact'
import { SHELL, VOLLEY, seedOf } from './impactEffect'
import { COLORS, stopPoint } from './marchShared'
import { worldPerPixel } from './screenScale'
import { Tracers, type LiveAttack } from './Tracers'
import type { Board } from './useBoard'

/** The strip is this many body widths to each side of the path: the head's half width plus room for the soft shadow. */
const STRIP = 1.9
/** The contact shadow falls away from the light (which stands north), toward the viewer. */
const LIGHT_PUSH = { x: 0, z: 1 }
/** Vertices across the strip, and along it at most this far apart: enough for the arrow to follow the slopes. */
const COLUMNS = lateralColumns(11)
const STEP = 5
/** The arrow floats this far above the terrain (plus a little more as it widens), so slopes do not cut it. */
const RAISE = 1.1
/** The glowing band from the unit to its target is hidden for now (the fire, smoke and shell tracers at both ends stay). Set true to bring it back. */
const SHOW_BAND = false

/**
 * The arrow of one attack, from the attacking unit to its target, shown while the attack is on: a row of chevrons on the ground
 * (yellow for Ángeles' guns, red for the División del Norte) that drift toward the target along a thin shaft, with fire and
 * smoke where it lands and, for the artillery, shells streaking in. (The older painted band is `SHOW_BAND`.)
 */
export function Arrow({ attack, marches, board }: { attack: { unit: string; target: string; endTime: number }; marches: ResolvedMarch[]; board: Board }) {
  const unit = UNITS.find((u) => u.id === attack.unit)!
  const start = useMemo(() => stopPoint(unit.start, board.places), [unit, board])
  const target = useMemo(() => board.places.get(attack.target)!, [board, attack])
  const color = COLORS[unit.track]
  // Ángeles' lane is the artillery; Villa's is infantry.
  const kind = unit.track === 'angeles' ? SHELL : VOLLEY
  const seed = useMemo(() => seedOf(`${attack.unit}>${attack.target}`), [attack])
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const height = useThree((s) => s.size.height)
  const heights = useHeightMap()
  const ground = useHeightField()
  // Where the arrow starts depends on where the unit is and where it came from; both only change in marches, so keep the line in state.
  const [line, setLine] = useState(() => attackLine(start, target))
  const last = useRef('')
  const mesh = useRef<Mesh>(null)
  const chevrons = useRef<Mesh>(null)
  const live = useRef<LiveAttack>({ strength: 0, from: line.from, to: line.to, muzzles: unit.track === 'angeles' ? (GUN_MUZZLES[muzzleKey(attack.unit, attack.target)] ??= []) : undefined })

  const geometry = useMemo(() => {
    const plan = bowedPlan(line.from, line.to, bowAmount(Math.hypot(line.to.x - line.from.x, line.to.z - line.from.z)))
    const strip = arrowStrip(resamplePlan(plan, STEP), COLUMNS)
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(strip.positions, 3))
    g.setAttribute('along', new BufferAttribute(strip.along, 1))
    g.setAttribute('side', new BufferAttribute(strip.side, 1))
    g.setAttribute('norm', new BufferAttribute(strip.normals, 2))
    g.setIndex(new BufferAttribute(strip.index, 1))
    g.userData.length = strip.length
    return g
  }, [line])
  const material = useMemo(() => arrowMaterial(color, heights), [color, heights]) as ShaderMaterial
  const chevronMat = useMemo(() => chevronMaterial(CHEVRON_PAINT[unit.track] ?? color, heights), [unit, color, heights])
  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])
  useEffect(() => () => chevronMat.dispose(), [chevronMat])

  useFrame((state) => {
    const t = clock.time
    const now = activeAttacks(EVENTS, t).find((a) => a.attack === attack)
    const strength = now ? now.strength : 0
    live.current.strength = strength
    live.current.from = line.from
    live.current.to = line.to
    if (mesh.current) mesh.current.visible = SHOW_BAND && strength > 0
    if (chevrons.current) chevrons.current.visible = strength > 0
    if (strength <= 0) return

    const from = unitPosition(start, marches.filter((m) => m.unit === unit.id), unit.id, t)
    const own = marches.filter((m) => m.unit === unit.id && m.start <= t).sort((a, b) => b.start - a.start)[0]
    const next = attackLine(from, target, own ? own.path[0] : undefined)
    const key = [next.from.x, next.from.z].map((v) => Math.round(v / 2)).join(',')
    if (key !== last.current) {
      last.current = key
      setLine(next)
    }

    // Width follows the lens: the same share of the screen in a wide and a medium shot.
    const length = geometry.userData.length as number
    const wpp = worldPerPixel(camera, { x: (line.from.x + line.to.x) / 2, y: (line.from.y + line.to.y) / 2, z: (line.from.z + line.to.z) / 2 }, height)
    const body = bodyWidth(wpp, height, length)
    const lng = longness(length / wpp, height)
    const rising = t - now!.start <= attack.endTime - t
    const { s0, s1 } = arrowSpan(strength, rising, length)
    const u = material.uniforms
    arrowOutline(s0, s1, body).forEach((p, i) => u.uP.value[i].set(p.s, p.y))
    u.uTime.value = fx.time
    u.uGeom.value = body * STRIP
    u.uBody.value = body
    u.uRaise.value = RAISE + body * 0.08
    u.uStrength.value = strength
    u.uOpacity.value = bodyOpacity(lng)
    u.uLong.value = lng
    u.uS0.value = s0
    u.uS1.value = s1
    u.uLight.value.set(LIGHT_PUSH.x, LIGHT_PUSH.z)
    u.uShadowOffset.value = body * 0.3

    // The chevrons: the same strip and span, drawn as a chain that keeps its width on screen like the band did, and drifts to the target.
    const width = chevronWidth(wpp, height, length)
    const c = chevronMat.uniforms
    c.uGeom.value = width * 1.1
    c.uBody.value = width
    c.uRaise.value = RAISE + width * 0.06
    c.uS0.value = s0
    c.uS1.value = s1
    c.uStrength.value = strength
    c.uOpacity.value = 1 - 0.12 * lng
    c.uPhase.value = (fx.time * CHEVRON_SPEED) % 1
  })
  return (
    <>
      <mesh ref={mesh} geometry={geometry} material={material} frustumCulled={false} renderOrder={3} visible={false} />
      <mesh ref={chevrons} geometry={geometry} material={chevronMat} frustumCulled={false} renderOrder={3} visible={false} />
      {kind.tracers && <Tracers live={live} kind={kind} color={color} seed={seed} ground={ground} />}
      <Impact live={live} kind={kind} fire={color} seed={seed} />
    </>
  )
}
