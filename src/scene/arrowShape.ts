import type { Vec3 } from '../camera/math'

/** A point of the arrow's outline: `s` along the arrow (world units), `y` across it, to one side (the shape is symmetric). */
export type OutlinePoint = { s: number; y: number }

/** Body width as a fraction of the viewport height: the same share of the screen in a wide and a medium shot. */
export const BODY_SCREEN = 0.078
/** Widest body (world units): a head twice that wide is still well inside a hill. */
export const MAX_BODY = 66
/** Narrowest body a long arrow keeps in a close-up (a short arrow keeps a sixteenth of its length). */
export const MIN_BODY = 9
/** Arrows shorter than this stay straight; longer ones bow sideways, like the sweeping arrows of a campaign map. */
export const BOW_FROM = 300

const HEAD_HALF = 1.0
const BODY_HALF = 0.5
const HEAD_LENGTH = 1.6
const NOTCH = 0.4
/** The head is never more than this share of the arrow, so a short or half-grown arrow keeps its proportions. */
const MAX_HEAD_SHARE = 0.42
/** How the body swells from the tail's point: (share of the way to the head, share of full width). Full width by about halfway. */
const BODY_PROFILE: readonly [number, number][] = [[0.1, 0.4], [0.28, 0.76], [0.55, 0.97], [1, 1]]

export const OUTLINE_POINTS = 7

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi)
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

/**
 * Half of the arrow's outline, tail to tip along one side (the other side is its mirror): a tail that tapers to a
 * point, a body that swells to `body` wide, and a head twice as wide with its barbs swept back. `s0` is the tail's
 * point and `s1` the tip. Exactly OUTLINE_POINTS points: the shader walks them as a polygon.
 */
export function arrowOutline(s0: number, s1: number, body: number): OutlinePoint[] {
  const len = Math.max(s1 - s0, 1e-3)
  const b = Math.min(body, (len * MAX_HEAD_SHARE) / HEAD_LENGTH)
  const barb = s1 - HEAD_LENGTH * b
  const join = barb + NOTCH * b
  const out: OutlinePoint[] = [{ s: s0, y: 0 }]
  for (const [u, w] of BODY_PROFILE) out.push({ s: s0 + u * (join - s0), y: BODY_HALF * b * w })
  out.push({ s: barb, y: HEAD_HALF * b }, { s: s1, y: 0 })
  return out
}

/** 0 for an arrow that is short on screen, 1 for one that crosses the whole frame (which must stay quiet, not shout). */
export function longness(lengthPx: number, viewportHeight: number): number {
  return smoothstep(0.35, 1.1, lengthPx / Math.max(viewportHeight, 1))
}

/**
 * Body width in world units: a fixed share of the screen (thinner when the arrow is very long), kept between a floor,
 * so a close-up does not draw a snake, and MAX_BODY, so it never swallows a hill.
 */
export function bodyWidth(worldPerPixel: number, viewportHeight: number, length: number): number {
  const thin = 1 - 0.42 * longness(length / Math.max(worldPerPixel, 1e-6), viewportHeight)
  const floor = Math.min(length / 16, MIN_BODY)
  return clamp(worldPerPixel * BODY_SCREEN * viewportHeight * thin, floor, MAX_BODY)
}

/** Opacity of the body: 0.72 for a short arrow, down to 0.42 for one that crosses the frame. */
export const bodyOpacity = (lng: number) => 0.72 - 0.30 * lng

/** How far the arrow sideways bows, in world units (0 for a short arrow). */
export function bowAmount(length: number): number {
  return length < BOW_FROM ? 0 : Math.min(0.07 * length, 80)
}

/**
 * The plan of the arrow from `from` to `to`, bowed to the left of the way it travels (north, for an arrow heading east)
 * by `bulge` at its middle, as `n + 1` points. Heights are left for the caller to drape onto the terrain.
 */
export function bowedPlan(from: Vec3, to: Vec3, bulge: number, n = 14): Vec3[] {
  const dx = to.x - from.x, dz = to.z - from.z
  const l = Math.hypot(dx, dz) || 1
  // The control point of a quadratic curve sits twice as far out as the curve's own middle does.
  const cx = (from.x + to.x) / 2 + (dz / l) * bulge * 2
  const cz = (from.z + to.z) / 2 - (dx / l) * bulge * 2
  const out: Vec3[] = []
  for (let i = 0; i <= n; i++) {
    const t = i / n, m = 1 - t
    out.push({
      x: m * m * from.x + 2 * m * t * cx + t * t * to.x,
      y: from.y + (to.y - from.y) * t,
      z: m * m * from.z + 2 * m * t * cz + t * t * to.z,
    })
  }
  return out
}

/**
 * Which stretch of the path the arrow covers, as distances along it. When an attack begins the tip runs out toward the
 * target; when it ends the tail is drawn in after it, so the arrow seems to be spent on the target. `strength` is the
 * attack's fade (0..1).
 */
export function arrowSpan(strength: number, rising: boolean, length: number): { s0: number; s1: number } {
  const e = 1 - Math.pow(1 - clamp(strength, 0, 1), 3)
  return rising ? { s0: 0, s1: length * e } : { s0: length * (1 - e), s1: length }
}

/** The points of a polyline with no gap wider than `step` (every original vertex kept), so the strip follows the terrain's small features. */
export function resamplePlan(points: readonly Vec3[], step: number): Vec3[] {
  const out: Vec3[] = []
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1]
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / step))
    for (let k = 0; k < n; k++) out.push({ x: a.x + ((b.x - a.x) * k) / n, y: 0, z: a.z + ((b.z - a.z) * k) / n })
  }
  out.push({ ...points[points.length - 1], y: 0 })
  return out
}

/** Evenly spaced positions across the strip, from -1 to 1: where its vertices stand, as a share of its half width. */
export const lateralColumns = (count: number): number[] => Array.from({ length: count }, (_, i) => (count === 1 ? 0 : (i / (count - 1)) * 2 - 1))

export type ArrowStrip = {
  /** x, 0, z of the path point, once per column: the shader moves it sideways and onto the terrain. */
  positions: Float32Array
  /** Distance along the path (world units) at each vertex. */
  along: Float32Array
  /** The column's lateral position (-1..1). */
  side: Float32Array
  /** Unit sidewards direction (x, z) at each vertex: the path's left in the ground plane. */
  normals: Float32Array
  index: Uint16Array
  length: number
}

/**
 * A strip along a plan, one vertex per column across, with no heights and no width: the vertex shader sets both (the
 * width follows the lens, the heights come from the terrain texture). Directions are found in the ground plane.
 */
export function arrowStrip(plan: readonly Vec3[], columns: readonly number[]): ArrowStrip {
  const n = plan.length
  if (n < 2) throw new Error('an arrow needs at least two points')
  const c = columns.length
  const dist = new Float32Array(n)
  for (let i = 1; i < n; i++) dist[i] = dist[i - 1] + Math.hypot(plan[i].x - plan[i - 1].x, plan[i].z - plan[i - 1].z)
  const length = dist[n - 1]
  const positions = new Float32Array(n * c * 3)
  const along = new Float32Array(n * c)
  const side = new Float32Array(n * c)
  const normals = new Float32Array(n * c * 2)
  for (let i = 0; i < n; i++) {
    const a = plan[Math.max(i - 1, 0)], b = plan[Math.min(i + 1, n - 1)]
    let tx = b.x - a.x, tz = b.z - a.z
    const tl = Math.hypot(tx, tz) || 1
    tx /= tl
    tz /= tl
    for (let k = 0; k < c; k++) {
      const v = i * c + k
      positions.set([plan[i].x, 0, plan[i].z], v * 3)
      along[v] = dist[i]
      side[v] = columns[k]
      normals.set([-tz, tx], v * 2)
    }
  }
  const index = new Uint16Array((n - 1) * (c - 1) * 6)
  let o = 0
  for (let i = 0; i < n - 1; i++) {
    for (let k = 0; k < c - 1; k++) {
      const v = i * c + k
      index.set([v, v + 1, v + c, v + 1, v + c + 1, v + c], o)
      o += 6
    }
  }
  return { positions, along, side, normals, index, length }
}
