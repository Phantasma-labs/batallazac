import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef, type CSSProperties } from 'react'
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  Points,
  PointsMaterial,
  type Group,
  type PerspectiveCamera,
} from 'three'
import { clock } from '../timeline/clock'
import { EVENTS } from '../timeline/events'
import { fx } from '../timeline/fxTime'
import { barsAt, lossRanks, presenceOf } from '../timeline/strength'
import type { ResolvedMarch, Unit } from '../timeline/model'
import '../ui/formation.css'
import { CLOTH, clothGeometry, clothMaterial } from './flagCloth'
import {
  BAR,
  CHEVRON,
  EDGE,
  FORM,
  GUN,
  attackingAt,
  blendOf,
  chevronXs,
  columnSnake,
  dampAngle,
  extentOf,
  facingAt,
  fitRank,
  flicker,
  frontRipple,
  hash01,
  layoutOf,
  makeUnitTrack,
  makeWalk,
  mixSlot,
  newUnitState,
  slotReach,
  standoffAt,
  standoffScale,
  stepBob,
  unitStateAt,
  yawOf,
  type Aim,
  type RankPose,
  type Slot,
  type Squad,
  type UnitState,
} from './formation'
import { chevronGeometry, pieceGeometry } from './formationGeometry'
import { GUN_MUZZLES, gunAims, muzzleKey } from './gunFire'
import { LABELS } from './labels'
import { COLORS, stopPoint } from './marchShared'
import { screenScale, worldPerPixel } from './screenScale'
import { keepOutRects, pickLabelSpot } from './unitLabel'
import type { Board } from './useBoard'
import { useHeightField } from './useHeightField'
import { pick } from '../i18n'

const POLE = 96
/** The bars: the ink outline, the cream edge and the paint. The lane's colour is the flag's and the trails'; the bars are painted a stronger shade of it. */
const INK = '#150e08'
const CREAM = '#fff5d6'
const PAINT: Record<string, string> = { angeles: '#c80f1e', villa: '#c80f1e' }
const SPARK = new Color('#fff0b8')
/**
 * Ángeles' battery is one formation until it divides, and two units of the timeline: `angeles` (the half that marches to Loreto) and
 * `angeles-rear` (the half that stays). Each draws its own half of the guns where they stand in the whole, from the same place, facing
 * the same way, so that together they are the battery until the first half sets off.
 */
const BATTERY: Record<string, { squad: Squad; movers: string }> = {
  angeles: { squad: 'movers', movers: 'angeles' },
  'angeles-rear': { squad: 'stayers', movers: 'angeles' },
}
/** The minutes a half takes, from the moment it parts, to settle: its flag, chevron and name chip glide to the middle of its own front. */
const PART_MINUTES = 4
/** A smooth rise from 0 (at `a`) to 1 (at `b`). */
const smooth = (a: number, b: number, x: number) => {
  const k = Math.min(Math.max((x - a) / (b - a), 0), 1)
  return k * k * (3 - 2 * k)
}
/** The pieces are drawn after the ground's ink and glows (2, 3), the flag and the sparks after the pieces. */
const PIECE_ORDER = 6
const FLAG_ORDER = 7

/** A soft round glow, drawn once and shared. */
let haloTexture: CanvasTexture | null = null
function halo(): CanvasTexture {
  if (haloTexture) return haloTexture
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.25, 'rgba(255,255,255,0.45)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  haloTexture = new CanvasTexture(c)
  return haloTexture
}

/** A small bright core with a cross of light through it: a muzzle flash, drawn once and shared. */
let sparkTexture: CanvasTexture | null = null
function spark(): CanvasTexture {
  if (sparkTexture) return sparkTexture
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 14)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.35, 'rgba(255,255,255,0.8)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 64)
  for (const across of [true, false]) {
    const line = across ? ctx.createLinearGradient(0, 0, 64, 0) : ctx.createLinearGradient(0, 0, 0, 64)
    line.addColorStop(0, 'rgba(255,255,255,0)')
    line.addColorStop(0.5, 'rgba(255,255,255,0.95)')
    line.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = line
    if (across) ctx.fillRect(0, 30, 64, 4)
    else ctx.fillRect(30, 0, 4, 64)
  }
  sparkTexture = new CanvasTexture(c)
  return sparkTexture
}

const glowing = (color: string, intensity: number) => new MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.6, metalness: 0, transparent: true })

type Pose = { state: UnitState; face: { x: number; z: number }; pose: RankPose; slot: Slot }
type Live = Pose & {
  yaw: number | null
  /** 0 standing .. 1 marching, and 0 .. 1 while the unit fires: eased. */
  walk: number
  fire: number
  wave: number
  /** 0 in a column .. 1 deployed in a front: eased. */
  deploy: number
  labelX: number
  labelZ: number
  box: { x0: number; x1: number; z0: number; z1: number }
  spot: { x: number; z: number }
}

/** What a unit aims at: a place and the minutes it fires on it, and whose attack it is. */
type Fires = Aim & { target: string; unit: string }

/**
 * One unit of the timeline as it was drawn before the statues: a force of crisp, outlined bars with a lit chevron at its head and
 * a glowing flag, with its name on a chip beside it. Standing or attacking it is deployed in a front (infantry: three staggered lines
 * of bars; artillery: a line of guns with caissons behind); marching it closes up into a column that points where it goes. It
 * stands at its unit's place (a little ahead of it before its first march, short of it after), keeps its size on screen, lies on the
 * terrain, steps and ripples while it walks and sparkles at its front while the unit has an attack on. The guns' barrel mouths are
 * where the shells leave from (`GUN_MUZZLES`).
 * Ángeles' battery is two units (see `BATTERY`) that are drawn as one formation until it divides.
 */
export function Force({ unit, marches, board }: { unit: Unit; marches: ResolvedMarch[]; board: Board }) {
  const color = COLORS[unit.track]
  const ground = useHeightField()
  const track = useMemo(() => makeUnitTrack(stopPoint(unit.start, board.places), marches.filter((m) => m.unit === unit.id)), [unit, marches, board])
  const battery = BATTERY[unit.id]
  const squad = battery?.squad
  // The minute the battery divides: when the half that goes sets off.
  const apart = useMemo(() => (battery ? Math.min(...marches.filter((m) => m.unit === battery.movers).map((m) => m.start)) : Infinity), [battery, marches])
  // What the unit aims at, for turning to it and for firing. The half that stays aims, until the battery divides, at what the whole battery does.
  const aims = useMemo<Fires[]>(() => {
    if (squad === 'stayers') {
      return gunAims(EVENTS, (id) => board.places.get(id)!, apart).stayers.map((a) => ({ ...a, target: a.target!, unit: a.unit! }))
    }
    return EVENTS.flatMap((e) =>
      (e.attacks ?? [])
        .filter((a) => a.unit === unit.id)
        .map((a) => {
          const p = board.places.get(a.target)!
          return { from: a.startTime ?? e.time, to: a.endTime, x: p.x, z: p.z, target: a.target, unit: a.unit }
        }),
    )
  }, [unit, squad, apart, board])
  /** How far its first march goes (both halves of the battery stand off by the same, as long as they are together). */
  const firstWalk = useMemo(() => {
    const first = marches.filter((m) => m.unit === (battery ? battery.movers : unit.id)).sort((a, b) => a.start - b.start)[0]
    return first ? makeWalk(first).length : 0
  }, [battery, unit, marches])
  const layout = useMemo(() => layoutOf(unit.track, squad), [unit, squad])
  /** The order the bars of a beaten infantry force go in (see `LOSSES`): the back line and the wings first. Guns are never lost. */
  const ranks = useMemo(() => lossRanks(layout), [layout])
  const whole = useMemo(() => extentOf(unit.track), [unit])
  const mine = useMemo(() => extentOf(unit.track, squad), [unit, squad])
  const heads = useMemo(() => chevronXs(unit.track, squad), [unit, squad])
  const keepOut = useMemo(() => keepOutRects(LABELS, board.places), [board])
  /** The corners of the force's box in its frame (ahead, to the right, ahead, to the left, behind, ...), to find where its name chip can stand. */
  const corners = useMemo(() => new Float64Array(8), [])
  /** Half the chip's width in pixels: the label's letters and its padding. */
  const chipHalf = useMemo(() => (pick(unit.label).length * 7.9 + 28) / 2, [unit])
  const shared = useMemo(() => ({ head: chevronGeometry(), cloth: clothGeometry() }), [])
  useEffect(() => () => shared.cloth.dispose(), [shared])

  const materials = useMemo(
    () => ({
      ink: new MeshStandardMaterial({ color: INK, emissive: '#0b0805', emissiveIntensity: 0.4, roughness: 0.9, metalness: 0, transparent: true }),
      cream: glowing(CREAM, 0.8),
      fill: glowing(PAINT[unit.track] ?? color, 0.5),
      pole: new MeshStandardMaterial({ color: '#f4ead4', emissive: '#f4ead4', emissiveIntensity: 0.5, toneMapped: false, transparent: true }),
      finial: new MeshStandardMaterial({ color: '#ffd98a', emissive: '#ffd98a', emissiveIntensity: 0.8, toneMapped: false, transparent: true }),
      cloth: clothMaterial(color),
      spark: new PointsMaterial({ map: spark(), size: 20, sizeAttenuation: false, transparent: true, depthWrite: false, blending: AdditiveBlending, vertexColors: true }),
    }),
    [unit, color],
  )
  useEffect(() => () => Object.values(materials).forEach((m) => m.dispose()), [materials])

  /** One instanced mesh per layer (ink, cream, paint) of each kind of piece, and the sparks at the pieces' fronts. */
  const parts = useMemo(() => {
    const kinds = [...new Set(layout.map((p) => p.kind))]
    const slots = layout.map(() => ({ set: 0, j: 0 }))
    const sets = kinds.map((kind, set) => {
      const mine = layout.flatMap((p, i) => (p.kind === kind ? [i] : []))
      mine.forEach((piece, j) => (slots[piece] = { set, j }))
      const layers = pieceGeometry(kind)
      const mesh = (geometry: BufferGeometry, material: MeshStandardMaterial) => {
        const m = new InstancedMesh(geometry, material, mine.length)
        m.frustumCulled = false
        m.renderOrder = PIECE_ORDER
        return m
      }
      return { ink: mesh(layers.ink, materials.ink), cream: mesh(layers.cream, materials.cream), fill: mesh(layers.fill, materials.fill) }
    })
    const sparks = new Points(new BufferGeometry(), materials.spark)
    sparks.geometry.setAttribute('position', new BufferAttribute(new Float32Array(layout.length * 3), 3))
    sparks.geometry.setAttribute('color', new BufferAttribute(new Float32Array(layout.length * 3), 3))
    sparks.frustumCulled = false
    sparks.renderOrder = FLAG_ORDER
    return { sets, slots, sparks }
  }, [layout, materials])
  useEffect(
    () => () => {
      parts.sets.forEach((s) => [s.ink, s.cream, s.fill].forEach((m) => m.dispose()))
      parts.sparks.geometry.dispose()
    },
    [parts],
  )
  // Each bar of the paint is a hair lighter or darker than the next, so a front does not look stamped.
  useLayoutEffect(() => {
    const shade = new Color()
    layout.forEach((_, i) => {
      const { set, j } = parts.slots[i]
      parts.sets[set].fill.setColorAt(j, shade.setScalar(0.94 + 0.1 * hash01(i + 7)))
    })
    parts.sets.forEach((s) => {
      if (s.fill.instanceColor) s.fill.instanceColor.needsUpdate = true
    })
  }, [parts, layout])

  const root = useRef<Group>(null)
  const head = useRef<Group>(null)
  const flag = useRef<Group>(null)
  const label = useRef<Group>(null)
  const chip = useRef<HTMLDivElement>(null)
  const dummy = useMemo(() => {
    const o = new Object3D()
    o.rotation.order = 'ZXY'
    return o
  }, [])
  const live = useRef<Live>({
    state: newUnitState(),
    face: { x: 1, z: 0 },
    pose: { y: 0, pitch: 0, roll: 0 },
    slot: { x: 0, z: 0, s: 1, sz: 1, yaw: 0 },
    yaw: null,
    walk: 0,
    fire: 0,
    wave: 0,
    deploy: NaN,
    labelX: NaN,
    labelZ: NaN,
    box: { x0: 0, x1: 0, z0: 0, z1: 0 },
    spot: { x: 0, z: 0 },
  })
  // The barrel mouths of this unit's guns, by the place they fire on (the arrays are shared with `Arrow`, `Tracers` and `Impact`). Only
  // for the unit's own attacks: the half that stays also fires with the whole battery, but those shells are drawn from the other half.
  const own = useMemo(() => aims.filter((a) => a.unit === unit.id), [aims, unit])
  const muzzleKeys = useMemo(() => [...new Set(own.map((a) => muzzleKey(unit.id, a.target)))], [own, unit])
  useEffect(
    () => () => {
      for (const k of muzzleKeys) if (GUN_MUZZLES[k]) GUN_MUZZLES[k].length = 0
    },
    [muzzleKeys],
  )

  useFrame((state, delta) => {
    const group = root.current
    if (!group) return
    const l = live.current
    const t = clock.time
    const st = unitStateAt(track, t, l.state)
    facingAt(track, aims, t, st, l.face)
    const turn = yawOf(l.face.x, l.face.z)
    l.yaw = l.yaw === null ? turn : dampAngle(l.yaw, turn, delta)
    l.walk += ((st.walking && clock.playing ? 1 : 0) - l.walk) * (1 - Math.exp(-8 * delta))
    l.fire += ((attackingAt(aims, t) && !st.walking ? 1 : 0) - l.fire) * (1 - Math.exp(-6 * delta))
    const deployed = st.walking ? 0 : 1
    l.deploy = Number.isNaN(l.deploy) ? deployed : l.deploy + (deployed - l.deploy) * (1 - Math.exp(-2.6 * delta))

    // The force keeps its size on screen: `scale` world units to a model unit.
    const camera = state.camera as PerspectiveCamera
    const height = state.size.height
    const scale = screenScale(camera, st, height, 1, (FORM.pixelsPerUnit * height) / 768, FORM.minScale, FORM.maxScale)
    const cos = Math.cos(l.yaw), sin = -Math.sin(l.yaw)
    const stand = standoffAt(st, standoffScale(firstWalk, scale)) * scale
    const x = st.x + cos * stand, z = st.z + sin * stand
    const y = ground(x, z)
    group.position.set(x, y, z)
    group.rotation.y = l.yaw
    group.scale.setScalar(scale)

    const time = fx.time
    const sparks = parts.sparks.geometry
    const sparkAt = sparks.getAttribute('position') as BufferAttribute
    const sparkLight = sparks.getAttribute('color') as BufferAttribute
    parts.sparks.visible = l.fire > 0.02
    const slot = l.slot
    // The barrels of the firing unit's guns: where the shells leave from.
    const firing = own.filter((a) => t >= a.from && t <= a.to)
    for (const k of muzzleKeys) if (GUN_MUZZLES[k]) GUN_MUZZLES[k].length = 0
    const bars = barsAt(unit.id, t)
    for (let i = 0; i < layout.length; i++) {
      const piece = layout[i]
      const blend = blendOf(l.deploy, piece.delay)
      const here = piece.kind === 'gun' ? 1 : presenceOf(ranks[i], bars) // a bar of a beaten force shrinks away
      mixSlot(piece, blend, slot)
      const reach = slotReach(piece.kind, slot)
      const flash = flicker(time, i) * l.fire * blend * here
      // Along the force (+X forward) and across it: a front ripples as it walks, a column snakes; a gun that fires kicks back.
      const px = slot.x + frontRipple(time, slot.z, l.walk) * blend - (piece.kind === 'gun' ? flash * 1.8 : 0)
      const pz = slot.z + columnSnake(time, slot.x, l.walk) * (1 - blend)
      const wx = x + (cos * px - sin * pz) * scale
      const wz = z + (sin * px + cos * pz) * scale
      const rank = fitRank(ground, wx, wz, cos, sin, Math.max(reach.back, 0.5) * scale, Math.max(reach.side, 0.5) * scale, l.pose)
      const py = (rank.y - y) / scale + stepBob(time, i, l.walk)
      const turned = slot.yaw + l.walk * Math.sin(time * 2.7 + i * 1.9) * 0.05
      dummy.position.set(px, py, pz)
      dummy.rotation.set(rank.roll, turned, rank.pitch)
      const size = Math.max(slot.s * here, 1e-4)
      dummy.scale.set(size, size, size * slot.sz)
      dummy.updateMatrix()
      const { set, j } = parts.slots[i]
      parts.sets[set].ink.setMatrixAt(j, dummy.matrix)
      parts.sets[set].cream.setMatrixAt(j, dummy.matrix)
      parts.sets[set].fill.setMatrixAt(j, dummy.matrix)
      const ahead = piece.kind === 'gun' ? GUN.barrelFrom + GUN.barrelLen + 1 : reach.front + 1
      sparkAt.setXYZ(i, px + ahead, py + BAR.height + 3, pz)
      sparkLight.setXYZ(i, SPARK.r * flash * 1.4, SPARK.g * flash * 1.4, SPARK.b * flash * 1.4)
      if (piece.kind === 'gun' && slot.s > 0.5) {
        const tip = (GUN.barrelFrom + GUN.barrelLen) * size
        const mx = px + tip * Math.cos(turned), mz = pz - tip * Math.sin(turned)
        for (const a of firing) {
          const out = (GUN_MUZZLES[muzzleKey(unit.id, a.target)] ??= [])
          out.push({ x: x + (cos * mx - sin * mz) * scale, y: y + (py + BAR.height * 0.7) * scale, z: z + (sin * mx + cos * mz) * scale })
        }
      }
    }
    parts.sets.forEach((s) => {
      s.ink.instanceMatrix.needsUpdate = true
      s.cream.instanceMatrix.needsUpdate = true
      s.fill.instanceMatrix.needsUpdate = true
    })
    sparkAt.needsUpdate = true
    sparkLight.needsUpdate = true
    materials.spark.size = (30 * height) / 768

    // Once a half of the battery has parted from the rest, its chevron, flag and chip move to the middle of its own front (of the column's
    // axis while it marches).
    const spread = squad ? smooth(apart, apart + PART_MINUTES, t) : 0
    const across = mine.mid * spread * blendOf(l.deploy, 0.2)
    // The chevron at the head: ahead of the front when deployed, of the column when marching.
    const lead = heads.column + (heads.front - heads.column) * blendOf(l.deploy, 0.2)
    if (head.current) {
      const rank = fitRank(ground, x + (cos * lead - sin * across) * scale, z + (sin * lead + cos * across) * scale, cos, sin, (CHEVRON.len / 2 + EDGE) * scale, (CHEVRON.half + EDGE) * scale, l.pose)
      head.current.position.set(lead, (rank.y - y) / scale + stepBob(time, 99, l.walk), across)
      head.current.rotation.set(rank.roll, 0, rank.pitch)
    }
    // The flag stands at the middle of the front, upright however the force turns. (The half that stays has none until it parts: it
    // would only stand on the other's, and the glows would add up.)
    if (flag.current) {
      flag.current.visible = squad !== 'stayers' || t >= apart
      flag.current.position.set(0, BAR.height + 0.4 + stepBob(time, 5, l.walk), across)
      flag.current.rotation.y = -l.yaw
    }
    l.wave += delta * (l.walk > 0.5 ? 9 : 4)
    materials.cloth.uniforms.uPhase.value = l.wave

    // The name chip: under the force, above it or beside it, wherever it lies over the least place name; it glides there. While the
    // battery is whole the chip is the box of the whole, and the half that stays has none (its name appears as it parts).
    if (label.current) {
      const grow = (a: number, b: number) => a + (b - a) * spread
      corners[0] = corners[2] = grow(whole.front, mine.front)
      corners[4] = corners[6] = -grow(whole.back, mine.back)
      corners[1] = corners[5] = across + grow(whole.side, mine.side)
      corners[3] = corners[7] = across - grow(whole.side, mine.side)
      if (chip.current) chip.current.style.opacity = String(squad === 'stayers' ? smooth(apart, apart + 2, t) : 1)
      const box = l.box
      box.x0 = box.z0 = Infinity
      box.x1 = box.z1 = -Infinity
      for (let c = 0; c < 8; c += 2) {
        const cx = x + (cos * corners[c] - sin * corners[c + 1]) * scale
        const cz = z + (sin * corners[c] + cos * corners[c + 1]) * scale
        box.x0 = Math.min(box.x0, cx)
        box.x1 = Math.max(box.x1, cx)
        box.z0 = Math.min(box.z0, cz)
        box.z1 = Math.max(box.z1, cz)
      }
      const wpp = worldPerPixel(camera, st, height)
      const spot = pickLabelSpot(box, chipHalf * wpp, 11 * wpp, keepOut, l.spot, 5 * wpp)
      const glide = Number.isNaN(l.labelX) ? 1 : 1 - Math.exp(-9 * delta)
      l.labelX = Number.isNaN(l.labelX) ? spot.x : l.labelX + (spot.x - l.labelX) * glide
      l.labelZ = Number.isNaN(l.labelZ) ? spot.z : l.labelZ + (spot.z - l.labelZ) * glide
      label.current.position.set(l.labelX, ground(l.labelX, l.labelZ), l.labelZ)
    }
  })

  return (
    <>
      <group ref={root}>
        {parts.sets.map((s, i) => (
          <group key={i}>
            <primitive object={s.ink} />
            <primitive object={s.cream} />
            <primitive object={s.fill} />
          </group>
        ))}
        <group ref={head}>
          <mesh geometry={shared.head.ink} material={materials.ink} renderOrder={PIECE_ORDER} />
          <mesh geometry={shared.head.cream} material={materials.cream} renderOrder={PIECE_ORDER} />
          <mesh geometry={shared.head.fill} material={materials.fill} renderOrder={PIECE_ORDER} />
        </group>
        <group ref={flag}>
          <mesh position={[0, POLE / 2, 0]} material={materials.pole} renderOrder={FLAG_ORDER}>
            <cylinderGeometry args={[1.2, 1.4, POLE, 8]} />
          </mesh>
          <mesh position={[0, POLE + 1, 0]} material={materials.finial} renderOrder={FLAG_ORDER}>
            <sphereGeometry args={[2.8, 12, 8]} />
          </mesh>
          <mesh geometry={shared.cloth} material={materials.cloth} position={[0, POLE - CLOTH.h / 2 - 1, 0]} renderOrder={FLAG_ORDER} />
          <sprite position={[-CLOTH.w / 2, POLE - CLOTH.h / 2 - 1, 0]} scale={[140, 140, 1]} renderOrder={3}>
            <spriteMaterial map={halo()} color={color} blending={AdditiveBlending} transparent depthWrite={false} opacity={0.6} />
          </sprite>
        </group>
        <primitive object={parts.sparks} />
      </group>
      <group ref={label}>
        <Html center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          <div ref={chip} className="unit-label" style={{ '--lane': color } as CSSProperties}>
            {pick(unit.label)}
          </div>
        </Html>
      </group>
    </>
  )
}
