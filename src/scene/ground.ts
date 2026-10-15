import { Box3, Raycaster, Vector3, type Object3D } from 'three'

/**
 * The height of the board at (x, z), found by casting a ray straight down onto `root` (the floor). Results are
 * memoised per point, and a point with no ground under it (off the board) gets `fallback`.
 */
export function makeGroundSampler(root: Object3D, fallback = 0): (x: number, z: number) => number {
  root.updateWorldMatrix(true, true)
  const top = new Box3().setFromObject(root).max.y + 10
  const ray = new Raycaster()
  const down = new Vector3(0, -1, 0)
  const from = new Vector3()
  const memo = new Map<string, number>()
  return (x, z) => {
    const key = `${Math.round(x * 4)},${Math.round(z * 4)}`
    const known = memo.get(key)
    if (known !== undefined) return known
    ray.set(from.set(x, top, z), down)
    const hit = ray.intersectObject(root, true)[0]
    const y = hit ? hit.point.y : fallback
    memo.set(key, y)
    return y
  }
}

/** A polyline between `points`, split into steps of at most `step` world units, with each point's height from `groundY` plus `lift`. */
export function drape(
  points: readonly { x: number; y: number; z: number }[],
  groundY: (x: number, z: number) => number,
  step = 6,
  lift = 0,
): { x: number; y: number; z: number }[] {
  const out: { x: number; y: number; z: number }[] = []
  for (let i = 0; i < points.length; i++) {
    const a = points[i]
    if (i === 0) out.push({ x: a.x, y: groundY(a.x, a.z) + lift, z: a.z })
    if (i === points.length - 1) break
    const b = points[i + 1]
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / step))
    for (let k = 1; k <= n; k++) {
      const x = a.x + ((b.x - a.x) * k) / n
      const z = a.z + ((b.z - a.z) * k) / n
      out.push({ x, y: groundY(x, z) + lift, z })
    }
  }
  return out
}
