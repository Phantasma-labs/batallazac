import type { Vec3 } from '../camera/math'
import { marchProgress, type ResolvedMarch, type Track } from '../timeline/model'
import type { HeightField } from './heightField'

/**
 * A unit on the board is a force of crisp, outlined bars with a lit chevron at its head and a glowing flag, and it has two
 * shapes. Standing or attacking it is deployed: a front of bars laid across its heading (infantry: three staggered lines;
 * artillery: a spaced line of guns with caissons behind). Marching it closes up into a column that points where it goes: two
 * files of bars end to end, a long bar whose axis is the heading. Sizes are in model units (the formation's own space: +X is
 * forward, +Y up, +Z to its right), where one unit is about one pixel on a 768 px high view of the wide shot; the component
 * scales the whole thing so it keeps that size on screen (see `FORM.pixelsPerUnit`).
 */
export type Kind = 'bar' | 'gun'

/** One bar of infantry: the painted top, a cream edge round it, an ink outline round that. Lengths across the front / along the march. */
export const BAR = { len: 21, depth: 9, height: 5.5, cream: 0.9, ink: 1.8, proud: 0.4 }
/** A gun: a carriage like a bar, and a barrel pointing forward. */
export const GUN = { len: 16, depth: 10, barrelFrom: 2.5, barrelLen: 16, barrelWidth: 5.6, barrelStripe: 1.8 }
/** Width of the cream and ink edges together. */
export const EDGE = BAR.cream + BAR.ink
/** The arrowhead at the head of a force: its length, half width, where the notch in its back reaches (fraction of the length back from the tip: the bigger, the shallower), and its gap to the first piece. */
export const CHEVRON = { len: 30, half: 17, notch: 0.72, gap: 3 }

export const FORM = {
  /** Screen pixels per model unit on a 768 px high view. */
  pixelsPerUnit: 1,
  /** Clamps of the scale, for a zoomed view (`?zoom=on`): never a speck, never a mass that buries a statue. */
  minScale: 0.2,
  maxScale: 6,
  /** How far (model units) a force stands ahead of its starting place before its first march, and short of every place it reaches. */
  standAhead: 70,
  standShort: 60,
  /** The force may give up at most this share of its first march to standing ahead and short, so it never looks stuck while the unit walks. */
  standShare: 0.4,
}

/**
 * A place in the formation's frame: where, how big (`s` overall, `sz` more along the piece's own long axis, which a marching bar
 * is shortened by), and how turned (radians). A piece of size 0 is not there.
 */
export type Slot = { x: number; z: number; s: number; sz: number; yaw: number }
/** One piece of a force: what it is, where it stands deployed and where in the column, and how late (0..1) it moves when the force changes shape. */
export type Piece = { kind: Kind; front: Slot; column: Slot; delay: number }

/** Spacing across the front (centre to centre) and between two lines. */
export const PITCH = { bar: 29.5, gun: 31 }
/** Distance along the march between two lines of infantry. */
export const LINE_GAP = 16.5
/** The column: how much a bar is shortened to march end to end, the space between two, and a gun's spacing along it. */
export const COLUMN = { seg: 0.72, gap: 0.6, gun: 27 }
/** The files of a column of infantry are this far from the middle, and a rank this far from the next. */
const SEG_ALONG = (BAR.len + 2 * EDGE) * COLUMN.seg
export const SEG_PITCH = SEG_ALONG + COLUMN.gap
const FILE_Z = (BAR.depth + 2 * EDGE) / 2 + COLUMN.gap / 2
/** How many bars of a column of infantry are in view: two files of six. The rest join when it deploys. */
const COLUMN_BARS = 12

const GUN_FILE_Z = GUN.len / 2 + EDGE + COLUMN.gap / 2

/** The two halves of the artillery when the battery divides: the guns that go on (the left of the front, seen from behind it) and the guns that stay. */
export type Squad = 'movers' | 'stayers'

const hidden = (x: number): Slot => ({ x, z: 0, s: 0, sz: 1, yaw: 0 })

/** The column of a set of artillery pieces: its guns in two files, those nearest the middle of the set leading, and the caissons out of sight. */
function artilleryColumn(pieces: Piece[]) {
  const guns = pieces.filter((p) => p.kind === 'gun')
  const across = guns.map((g) => g.front.z)
  const mid = (Math.min(...across) + Math.max(...across)) / 2
  guns
    .sort((a, b) => Math.abs(a.front.z - mid) - Math.abs(b.front.z - mid))
    .forEach((g, k) => {
      g.column = { x: -Math.floor(k / 2) * COLUMN.gun - (k % 2 ? COLUMN.gun / 2 : 0), z: k % 2 ? GUN_FILE_Z : -GUN_FILE_Z, s: 1, sz: 1, yaw: 0 }
    })
  for (const p of pieces) if (p.kind === 'bar') p.column = hidden(-2 * COLUMN.gun)
}

/**
 * The pieces of a force, with the middle of the front (and the head of the column) at (0, 0): infantry in a front line of seven,
 * a staggered line of six behind it and three more behind that (sixteen bars), marching as two files of six; artillery in a
 * line of seven guns with six caissons staggered behind, marching as two files of guns with the caissons out of sight. Ángeles'
 * track is the artillery; the División del Norte and the federal army (a later track) are infantry.
 *
 * `squad` asks for one half of the artillery (the guns on one side of the middle of the front with the caissons behind them),
 * which keeps the places it had in the whole, so that the two halves stand together exactly as the battery does and part when
 * one marches off, and has a column of its own. Nothing else divides: infantry ignore it.
 */
export function layoutOf(track: Track, squad?: Squad): Piece[] {
  const out: Piece[] = []
  const line = (kind: Kind, count: number, x: number, pitch: number, s = 1) => {
    for (let j = 0; j < count; j++) {
      const i = out.length
      out.push({
        kind,
        front: { x, z: (j - (count - 1) / 2) * pitch, s, sz: 1, yaw: (hash01(i + 3) - 0.5) * 0.14 },
        column: hidden(0),
        delay: hash01(i + 11),
      })
    }
  }
  if (track !== 'angeles') {
    line('bar', 7, 0, PITCH.bar)
    line('bar', 6, -LINE_GAP, PITCH.bar)
    line('bar', 3, -2 * LINE_GAP, PITCH.bar)
    // The bars nearest the middle of the front lead the column, the wings follow.
    const order = out.map((_, i) => i).sort((a, b) => out[b].front.x - out[a].front.x || Math.abs(out[a].front.z) - Math.abs(out[b].front.z))
    order.forEach((i, k) => {
      out[i].column =
        k < COLUMN_BARS
          ? { x: -Math.floor(k / 2) * SEG_PITCH, z: k % 2 ? FILE_Z : -FILE_Z, s: 1, sz: COLUMN.seg, yaw: Math.PI / 2 }
          : hidden(-2.5 * SEG_PITCH)
    })
  } else {
    line('gun', 7, 0, PITCH.gun)
    line('bar', 6, -(GUN.depth / 2 + EDGE) - (BAR.depth * 0.9) / 2 - EDGE - 3, PITCH.gun, 0.9)
    artilleryColumn(out)
    if (squad) {
      const half = out.filter((p) => (squad === 'movers' ? p.front.z <= 0 : p.front.z > 0))
      artilleryColumn(half)
      return half
    }
  }
  return out
}

/** How far a piece's base reaches ahead of / behind its centre, and to each side of it (model units, before its own scale). */
export function reachOf(kind: Kind): { front: number; back: number; side: number } {
  if (kind === 'gun') return { front: GUN.barrelFrom + GUN.barrelLen, back: GUN.depth / 2 + EDGE, side: GUN.len / 2 + EDGE }
  return { front: BAR.depth / 2 + EDGE, back: BAR.depth / 2 + EDGE, side: BAR.len / 2 + EDGE }
}

/** How far a piece in `slot` reaches ahead of, behind and to the side of its centre in the formation's frame (a turned bar swaps its length and thickness). */
export function slotReach(kind: Kind, slot: Slot): { front: number; back: number; side: number } {
  const r = reachOf(kind)
  const turned = Math.sin(slot.yaw) ** 2 // 0 across the front, 1 along the march
  const along = slot.s * (1 - turned) * 1
  const sideways = slot.s * slot.sz
  return {
    front: r.front * along + r.side * sideways * turned,
    back: r.back * along + r.side * sideways * turned,
    side: r.side * sideways * (1 - turned) + r.back * slot.s * turned,
  }
}

/** Where the middle of the front line of a force lies across it: 0, but for half a battery, which stands to one side of the middle of the whole. */
export function frontMid(track: Track, squad?: Squad): number {
  const pieces = layoutOf(track, squad)
  const lead = Math.max(...pieces.map((p) => p.front.x))
  const across = pieces.filter((p) => p.front.x === lead).map((p) => p.front.z)
  return (Math.min(...across) + Math.max(...across)) / 2
}

/** `side` is the half width of the box about `mid` (the middle of the front line, `frontMid`) when deployed, and about the axis (0) when marching. */
export type Extent = { front: number; back: number; side: number; mid: number }
/** The box a force covers in its frame, in either shape, chevron included: how far ahead of and behind its head it reaches, and to each side. */
export function extentOf(track: Track, squad?: Squad): Extent {
  const mid = frontMid(track, squad)
  const e = { front: 0, back: 0, side: 0, mid }
  for (const p of layoutOf(track, squad)) {
    for (const shape of ['front', 'column'] as const) {
      const slot = p[shape]
      if (slot.s <= 0) continue
      const r = slotReach(p.kind, slot)
      e.front = Math.max(e.front, slot.x + r.front)
      e.back = Math.max(e.back, -slot.x + r.back)
      e.side = Math.max(e.side, Math.abs(slot.z - (shape === 'front' ? mid : 0)) + r.side)
    }
  }
  const heads = chevronXs(track, squad)
  e.front = Math.max(e.front, Math.max(heads.front, heads.column) + CHEVRON.len / 2 + EDGE)
  e.side = Math.max(e.side, CHEVRON.half + EDGE)
  return e
}

/** Local x of the middle of the chevron at the head of a force deployed in a front and marching in a column. */
export function chevronXs(track: Track, squad?: Squad): { front: number; column: number } {
  const lead = (shape: 'front' | 'column') => {
    let reach = 0
    for (const p of layoutOf(track, squad)) {
      const slot = p[shape]
      if (slot.s > 0) reach = Math.max(reach, slot.x + slotReach(p.kind, slot).front)
    }
    return reach + CHEVRON.gap + CHEVRON.len / 2
  }
  return { front: lead('front'), column: lead('column') }
}

/** How far a piece has got from its place in the column (0) to its place in the front (1) when the force as a whole is `deploy` (0..1) of the way: each piece moves in its own time. */
export function blendOf(deploy: number, delay: number): number {
  const t = Math.min(1, Math.max(0, (deploy - delay * 0.55) / 0.45))
  return t * t * (3 - 2 * t)
}

/** The slot of `piece` at `blend` (0 column .. 1 front), written into `out`. */
export function mixSlot(piece: Piece, blend: number, out: Slot): Slot {
  const a = piece.column, b = piece.front
  out.x = a.x + (b.x - a.x) * blend
  out.z = a.z + (b.z - a.z) * blend
  out.s = a.s + (b.s - a.s) * blend
  out.sz = a.sz + (b.sz - a.sz) * blend
  out.yaw = a.yaw + (b.yaw - a.yaw) * blend
  return out
}

/** A walk: one march with its cumulative 3D lengths, so a position along it costs no allocation. */
export type Walk = { start: number; end: number; path: readonly Vec3[]; cum: Float64Array; length: number }
export type UnitTrack = { start: Vec3; walks: Walk[] }

export function makeWalk(m: Pick<ResolvedMarch, 'start' | 'end' | 'path'>): Walk {
  const cum = new Float64Array(m.path.length)
  for (let i = 1; i < m.path.length; i++) {
    const a = m.path[i - 1], b = m.path[i]
    cum[i] = cum[i - 1] + Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)
  }
  return { start: m.start, end: m.end, path: m.path, cum, length: cum[cum.length - 1] ?? 0 }
}

export function makeUnitTrack(start: Vec3, marches: readonly Pick<ResolvedMarch, 'start' | 'end' | 'path'>[]): UnitTrack {
  return { start, walks: marches.map(makeWalk).sort((a, b) => a.start - b.start) }
}

/** Where a unit is and which way it last moved. Filled in place, every frame. */
export type UnitState = { x: number; y: number; z: number; hx: number; hz: number; walking: boolean; moved: boolean; /** index of the march under way, and how far through it (0..1) */ walkIndex: number; progress: number }
export const newUnitState = (): UnitState => ({ x: 0, y: 0, z: 0, hx: 1, hz: 0, walking: false, moved: false, walkIndex: -1, progress: 0 })
const scratch = newUnitState()

/** Point `fraction` (0..1) along a walk by length, and the ground-plane direction of the segment it is on. */
export function sampleWalk(w: Walk, fraction: number, out: UnitState): UnitState {
  const n = w.path.length
  if (n === 1 || w.length === 0) {
    const p = w.path[0]
    out.x = p.x; out.y = p.y; out.z = p.z
    return out
  }
  const want = Math.min(Math.max(fraction, 0), 1) * w.length
  let i = 1
  while (i < n - 1 && w.cum[i] < want) i++
  const a = w.path[i - 1], b = w.path[i]
  const seg = w.cum[i] - w.cum[i - 1]
  const k = seg === 0 ? 0 : (want - w.cum[i - 1]) / seg
  out.x = a.x + (b.x - a.x) * k
  out.y = a.y + (b.y - a.y) * k
  out.z = a.z + (b.z - a.z) * k
  // The segment's direction; a vertical or zero-length one borrows its neighbour's.
  for (let s = i, step = 0; step < n; step++, s = (s % (n - 1)) + 1) {
    const dx = w.path[s].x - w.path[s - 1].x, dz = w.path[s].z - w.path[s - 1].z
    const d = Math.hypot(dx, dz)
    if (d > 1e-6) { out.hx = dx / d; out.hz = dz / d; break }
  }
  return out
}

/**
 * Where the unit stands at minute `t` (the same rule as `unitPosition`: at its start before its first march, at the end of the
 * last finished march between marches, along the path during one), whether it is walking, and its last direction of travel.
 */
export function unitStateAt(track: UnitTrack, t: number, out: UnitState): UnitState {
  out.x = track.start.x; out.y = track.start.y; out.z = track.start.z
  out.walking = false
  out.moved = false
  out.walkIndex = -1
  out.progress = 0
  for (let i = 0; i < track.walks.length; i++) {
    const w = track.walks[i]
    if (t < w.start) break
    out.progress = marchProgress(w, t)
    sampleWalk(w, out.progress, out)
    out.moved = true
    out.walkIndex = i
    if (t < w.end) {
      out.walking = true
      return out
    }
  }
  return out
}

/** An attack of the unit: from minute `from` to `to` it aims at the point (x, z). */
export type Aim = { from: number; to: number; x: number; z: number }
/** Closer than this to its target (world units) a unit has no direction to face it by: it stands on it. */
export const FACE_MIN = 40

/**
 * The direction (ground plane, unit length) the unit should face at minute `t`: where it is going while it walks; while it
 * stands, at its target while it attacks one (unless it is standing on it), else the way it last walked, else toward its
 * first march. Written into `out`.
 */
export function facingAt(track: UnitTrack, aims: readonly Aim[], t: number, st: UnitState, out: { x: number; z: number }): { x: number; z: number } {
  if (st.walking) {
    out.x = st.hx; out.z = st.hz
    return out
  }
  for (const a of aims) {
    if (t < a.from || t > a.to) continue
    const dx = a.x - st.x, dz = a.z - st.z
    const d = Math.hypot(dx, dz)
    if (d < FACE_MIN) continue
    out.x = dx / d; out.z = dz / d
    return out
  }
  if (st.moved) {
    out.x = st.hx; out.z = st.hz
    return out
  }
  for (const w of track.walks) {
    if (w.start <= t) continue
    sampleWalk(w, 0, scratch)
    out.x = scratch.hx; out.z = scratch.hz
    return out
  }
  out.x = 1; out.z = 0
  return out
}

/** Rotation about +Y that turns a formation's forward axis (+X) onto the ground direction (dx, dz). */
export const yawOf = (dx: number, dz: number) => Math.atan2(-dz, dx)

/** `current` moved toward `target` the short way round, eased: `rate` per second over `dt` seconds. */
export function dampAngle(current: number, target: number, dt: number, rate = 6): number {
  const turn = Math.atan2(Math.sin(target - current), Math.cos(target - current))
  return current + turn * (1 - Math.exp(-rate * Math.max(dt, 0)))
}

/** Height, pitch and roll that lay a rank block flat on the ground under it. */
export type RankPose = { y: number; pitch: number; roll: number }

/**
 * The block of a rank centred at world (x, z), `halfDepth` x `halfWidth` (world units) around it, facing the unit direction
 * (dx, dz): it takes the mean height of its four edge midpoints and tilts to the slope along and across the column.
 * Rotations are for an Euler 'XYZ' (pitch about the block's Z axis, roll about its X axis).
 */
export function fitRank(ground: HeightField, x: number, z: number, dx: number, dz: number, halfDepth: number, halfWidth: number, out: RankPose): RankPose {
  const lx = -dz, lz = dx // the block's own +Z in the ground plane
  const front = ground(x + dx * halfDepth, z + dz * halfDepth)
  const back = ground(x - dx * halfDepth, z - dz * halfDepth)
  const right = ground(x + lx * halfWidth, z + lz * halfWidth)
  const left = ground(x - lx * halfWidth, z - lz * halfWidth)
  out.y = (front + back + right + left) / 4
  out.pitch = Math.atan2(front - back, 2 * halfDepth)
  out.roll = 0 - Math.atan2(right - left, 2 * halfWidth) // (0 - x, so a flat slope gives +0, not -0)
  return out
}

const smooth = (t: number) => t * t * (3 - 2 * t)

/**
 * How far ahead of the unit's place its force stands, in model units (negative: behind it). Before its first march it stands
 * ahead, clear of whatever stands at its starting place (the locomotive, the guns' own statues); on its way it eases back
 * to stand short of the place it reaches, clear of the hill's statues, where its attack arrow starts.
 */
export function standoffAt(st: UnitState, k = 1): number {
  const { standAhead, standShort } = FORM
  if (st.walking) {
    const from = st.walkIndex === 0 ? standAhead : -standShort
    return (from + (-standShort - from) * smooth(st.progress)) * k
  }
  return (st.moved ? -standShort : standAhead) * k
}

/**
 * How much of the standoff a unit keeps (0..1): a short first march (`walkLength` world units, `scale` world units per model unit)
 * cannot spare 130 model units, or the force would hardly move while its unit does. It gives up `FORM.standShare` of the march at most.
 */
export function standoffScale(walkLength: number, scale: number): number {
  if (!(walkLength > 0) || !(scale > 0)) return 1
  return Math.min(1, (FORM.standShare * (walkLength / scale)) / (FORM.standAhead + FORM.standShort))
}

/** The piece steps (a hop) while the force walks, each at its own moment (`seed`), so the front never moves as one block. */
export const stepBob = (time: number, seed: number, walk: number) => walk * Math.abs(Math.sin(time * 6.5 + seed * 2.399)) * 2.6

/** A wave running across the front as it walks: how far ahead (model units) a piece at lateral position `z` is pushed. */
export const frontRipple = (time: number, z: number, walk: number) => walk * Math.sin(time * 4.2 - z * 0.045) * 1.8 + 0

/** A repeatable pseudo-random number in 0..1 for `i`, so every piece has its own character without storing any. */
export const hash01 = (i: number) => Math.abs(Math.sin(i * 12.9898 + 4.1414) * 43758.5453) % 1

/** A sway that runs down a column as it walks: how far to the side (model units) a piece at `x` along it is pushed. */
export const columnSnake = (time: number, x: number, walk: number) => walk * Math.sin(time * 3.4 + x * 0.06) * 1.8 + 0

/** Muzzle flash of piece `i` at `time`, 0..1: brief and bright at its own rhythm, off most of the time. */
export function flicker(time: number, i: number): number {
  const h = hash01(i)
  const v = Math.sin(time * (8 + h * 7) + h * 40)
  return v > 0.45 ? ((v - 0.45) / 0.55) ** 1.5 : 0
}

/** True while any of the unit's attacks is on at minute `t`. */
export function attackingAt(aims: readonly Aim[], t: number): boolean {
  for (const a of aims) if (t >= a.from && t <= a.to) return true
  return false
}
