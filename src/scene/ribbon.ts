import type { Vec3 } from '../camera/math'

export type RibbonGeometry = {
  /** x, y, z per vertex: two per path point, one on each side. */
  positions: Float32Array
  /** Fraction (0..1) of the path's length at each vertex. */
  along: Float32Array
  /** -1 on one side of the path, +1 on the other. */
  side: Float32Array
  index: Uint16Array
  /** Length of the path in world units. */
  length: number
}

/**
 * A flat strip `width` wide along a path, for glowing trails and arrows drawn on the ground. Sides are found in the
 * ground plane (x, z) from the path's direction at each point, so the strip lies flat wherever the path climbs.
 */
export function buildRibbon(path: readonly Vec3[], width: number): RibbonGeometry {
  const n = path.length
  if (n < 2) throw new Error('a ribbon needs at least two points')
  const positions = new Float32Array(n * 6)
  const along = new Float32Array(n * 2)
  const side = new Float32Array(n * 2)
  const dist = new Float32Array(n)
  for (let i = 1; i < n; i++) dist[i] = dist[i - 1] + Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y, path[i].z - path[i - 1].z)
  const length = dist[n - 1]
  for (let i = 0; i < n; i++) {
    const a = path[Math.max(i - 1, 0)], b = path[Math.min(i + 1, n - 1)]
    let tx = b.x - a.x, tz = b.z - a.z
    const tl = Math.hypot(tx, tz) || 1
    tx /= tl
    tz /= tl
    const nx = -tz * (width / 2), nz = tx * (width / 2)
    const p = path[i]
    positions.set([p.x + nx, p.y, p.z + nz, p.x - nx, p.y, p.z - nz], i * 6)
    along[i * 2] = along[i * 2 + 1] = length === 0 ? 0 : dist[i] / length
    side[i * 2] = 1
    side[i * 2 + 1] = -1
  }
  const index = new Uint16Array((n - 1) * 6)
  for (let i = 0; i < n - 1; i++) {
    const a = i * 2
    index.set([a, a + 1, a + 2, a + 1, a + 3, a + 2], i * 6)
  }
  return { positions, along, side, index, length }
}
