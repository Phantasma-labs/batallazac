import type { BufferGeometry, Mesh, Object3D } from 'three'

/**
 * The terrain's height at (x, z) without casting a ray per point. The triangles under `root` are filed once in a coarse
 * grid over the ground plane, and a lookup tests only the few in its cell. `makeGroundSampler` (ground.ts) casts a ray
 * against the whole floor for each new point, about 2 ms on the 60k-vertex floor: fine for a path, too slow for the
 * hundreds of points a label draped over the hills needs. Where triangles overlap (the frame over the rim) the highest wins;
 * a point with nothing under it gets `fallback`.
 */
export function makeHeightIndex(root: Object3D, cell = 12, fallback = 0): (x: number, z: number) => number {
  root.updateWorldMatrix(true, true)
  const tris: number[] = [] // x0 y0 z0 x1 y1 z1 x2 y2 z2 per triangle, in world space
  root.traverse((o) => {
    const mesh = o as Mesh
    if (!mesh.isMesh) return
    const geo: BufferGeometry = mesh.geometry
    const pos = geo.getAttribute('position')
    if (!pos) return
    const world = new Float32Array(pos.count * 3)
    const e = mesh.matrixWorld.elements
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const y = pos.getY(i)
      const z = pos.getZ(i)
      world[i * 3] = e[0] * x + e[4] * y + e[8] * z + e[12]
      world[i * 3 + 1] = e[1] * x + e[5] * y + e[9] * z + e[13]
      world[i * 3 + 2] = e[2] * x + e[6] * y + e[10] * z + e[14]
    }
    const index = geo.getIndex()
    const count = index ? index.count : pos.count
    for (let k = 0; k + 2 < count; k += 3) {
      for (let c = 0; c < 3; c++) {
        const v = (index ? index.getX(k + c) : k + c) * 3
        tris.push(world[v], world[v + 1], world[v + 2])
      }
    }
  })
  const n = tris.length / 9
  if (n === 0) return () => fallback

  let minX = Infinity
  let minZ = Infinity
  let maxX = -Infinity
  let maxZ = -Infinity
  for (let i = 0; i < tris.length; i += 3) {
    minX = Math.min(minX, tris[i])
    maxX = Math.max(maxX, tris[i])
    minZ = Math.min(minZ, tris[i + 2])
    maxZ = Math.max(maxZ, tris[i + 2])
  }
  const cols = Math.floor((maxX - minX) / cell) + 1
  const rows = Math.floor((maxZ - minZ) / cell) + 1
  const cellOf = (v: number, min: number, last: number) => Math.min(last, Math.max(0, Math.floor((v - min) / cell)))

  // Two passes over the triangles (count, then fill) give one flat list per cell without a million small arrays.
  const start = new Uint32Array(cols * rows + 1)
  const eachCell = (t: number, visit: (c: number) => void) => {
    const o = t * 9
    const x0 = Math.min(tris[o], tris[o + 3], tris[o + 6])
    const x1 = Math.max(tris[o], tris[o + 3], tris[o + 6])
    const z0 = Math.min(tris[o + 2], tris[o + 5], tris[o + 8])
    const z1 = Math.max(tris[o + 2], tris[o + 5], tris[o + 8])
    for (let r = cellOf(z0, minZ, rows - 1); r <= cellOf(z1, minZ, rows - 1); r++) {
      for (let c = cellOf(x0, minX, cols - 1); c <= cellOf(x1, minX, cols - 1); c++) visit(r * cols + c)
    }
  }
  for (let t = 0; t < n; t++) eachCell(t, (c) => start[c + 1]++)
  for (let c = 0; c < cols * rows; c++) start[c + 1] += start[c]
  const fill = start.slice(0, cols * rows)
  const list = new Uint32Array(start[cols * rows])
  for (let t = 0; t < n; t++) eachCell(t, (c) => (list[fill[c]++] = t))

  const EPS = -1e-6
  return (x, z) => {
    if (x < minX || x > maxX || z < minZ || z > maxZ) return fallback
    const c = cellOf(z, minZ, rows - 1) * cols + cellOf(x, minX, cols - 1)
    let best = -Infinity
    for (let i = start[c]; i < start[c + 1]; i++) {
      const o = list[i] * 9
      const ax = tris[o]
      const az = tris[o + 2]
      const bx = tris[o + 3] - ax
      const bz = tris[o + 5] - az
      const cx = tris[o + 6] - ax
      const cz = tris[o + 8] - az
      const det = bx * cz - bz * cx
      if (det === 0) continue
      const px = x - ax
      const pz = z - az
      const u = (px * cz - pz * cx) / det
      const v = (bx * pz - bz * px) / det
      if (u < EPS || v < EPS || u + v > 1 - EPS) continue
      const y = tris[o + 1] + u * (tris[o + 4] - tris[o + 1]) + v * (tris[o + 7] - tris[o + 1])
      if (y > best) best = y
    }
    return best === -Infinity ? fallback : best
  }
}
