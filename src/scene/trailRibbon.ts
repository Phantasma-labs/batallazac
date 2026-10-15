import type { Vec3 } from '../camera/math'

export type TrailRibbon = {
  /** x, y, z per vertex: the path point, two vertices each, at the height of the ground where that side lies. */
  positions: Float32Array
  /** Unit vector in the ground plane (x, z) across the path at each vertex, the same for both sides of a point. */
  across: Float32Array
  /** Fraction (0..1) of the path's length at each vertex. */
  along: Float32Array
  /** -1 on one side of the path, +1 on the other. */
  side: Float32Array
  index: Uint16Array
  /** Length of the path in world units (the sum of its 3D segments, like `pathLength`). */
  length: number
}

/**
 * The strip of a march's trail. Unlike `buildRibbon`, its width is not baked in: each vertex keeps the path point and the
 * direction across it, and the vertex shader pushes it out by the width the camera wants (a trail that keeps its width on
 * screen as the lens zooms). Heights are sampled where the strip's edges lie at `sampleHalf` (the widest it gets), so a
 * trail crossing a slope is not cut by the hill on its uphill side.
 */
export function buildTrailRibbon(path: readonly Vec3[], ground: (x: number, z: number) => number, sampleHalf: number, lift: number): TrailRibbon {
  const n = path.length
  if (n < 2) throw new Error('a trail needs at least two points')
  const positions = new Float32Array(n * 6)
  const across = new Float32Array(n * 4)
  const along = new Float32Array(n * 2)
  const side = new Float32Array(n * 2)
  const dist = new Float64Array(n)
  for (let i = 1; i < n; i++) dist[i] = dist[i - 1] + Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y, path[i].z - path[i - 1].z)
  const length = dist[n - 1]
  for (let i = 0; i < n; i++) {
    const a = path[Math.max(i - 1, 0)], b = path[Math.min(i + 1, n - 1)]
    let tx = b.x - a.x, tz = b.z - a.z
    const tl = Math.hypot(tx, tz) || 1
    tx /= tl
    tz /= tl
    const nx = -tz, nz = tx
    const p = path[i]
    positions.set([p.x, ground(p.x + nx * sampleHalf, p.z + nz * sampleHalf) + lift, p.z, p.x, ground(p.x - nx * sampleHalf, p.z - nz * sampleHalf) + lift, p.z], i * 6)
    across.set([nx, nz, nx, nz], i * 4)
    along[i * 2] = along[i * 2 + 1] = length === 0 ? 0 : dist[i] / length
    side[i * 2] = 1
    side[i * 2 + 1] = -1
  }
  const index = new Uint16Array((n - 1) * 6)
  for (let i = 0; i < n - 1; i++) {
    const a = i * 2
    index.set([a, a + 1, a + 2, a + 1, a + 3, a + 2], i * 6)
  }
  return { positions, across, along, side, index, length }
}

/** World units per pixel -> the trail's half width in world units, kept between `min` and `max` so it neither vanishes nor floods a close-up. */
export const trailHalfWidth = (worldPerPixel: number, halfPixels: number, min = 1.8, max = 9) => Math.min(Math.max(worldPerPixel * halfPixels, min), max)
