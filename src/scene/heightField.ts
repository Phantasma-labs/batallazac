import type { Mesh, Object3D } from 'three'
import { Vector3 } from 'three'

/** The height of the terrain at (x, z). */
export type HeightField = (x: number, z: number) => number

/**
 * The height of a surface made of triangles, looked up in constant time: every triangle is rasterised once into a grid of
 * the highest height per node (`positions` are world-space x, y, z per vertex, `index` the triangles, or null when the
 * vertices are already in triples). The ground sampler in `ground.ts` raycasts, which is fine for a path laid down at load
 * but far too slow for things that stand on the terrain every frame, like a formation turning on the spot.
 * Nodes no triangle reached (slivers thinner than a cell) take the mean of their neighbours; outside the surface the
 * nearest edge height is used.
 */
export function buildHeightField(positions: ArrayLike<number>, index: ArrayLike<number> | null, cell: number, fallback = 0): HeightField {
  const vertexCount = Math.floor(positions.length / 3)
  if (vertexCount < 3) return () => fallback
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity
  for (let i = 0; i < vertexCount; i++) {
    const x = positions[i * 3], z = positions[i * 3 + 2]
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (z < minZ) minZ = z
    if (z > maxZ) maxZ = z
  }
  const nx = Math.max(2, Math.ceil((maxX - minX) / cell) + 1)
  const nz = Math.max(2, Math.ceil((maxZ - minZ) / cell) + 1)
  const grid = new Float32Array(nx * nz).fill(NaN)

  const triangles = index ? Math.floor(index.length / 3) : Math.floor(vertexCount / 3)
  for (let t = 0; t < triangles; t++) {
    const ia = index ? index[t * 3] : t * 3
    const ib = index ? index[t * 3 + 1] : t * 3 + 1
    const ic = index ? index[t * 3 + 2] : t * 3 + 2
    const ax = positions[ia * 3], ay = positions[ia * 3 + 1], az = positions[ia * 3 + 2]
    const bx = positions[ib * 3], by = positions[ib * 3 + 1], bz = positions[ib * 3 + 2]
    const cx = positions[ic * 3], cy = positions[ic * 3 + 1], cz = positions[ic * 3 + 2]
    const det = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz)
    if (Math.abs(det) < 1e-9) continue
    const i0 = Math.max(0, Math.ceil((Math.min(ax, bx, cx) - minX) / cell))
    const i1 = Math.min(nx - 1, Math.floor((Math.max(ax, bx, cx) - minX) / cell))
    const j0 = Math.max(0, Math.ceil((Math.min(az, bz, cz) - minZ) / cell))
    const j1 = Math.min(nz - 1, Math.floor((Math.max(az, bz, cz) - minZ) / cell))
    for (let j = j0; j <= j1; j++) {
      const z = minZ + j * cell
      for (let i = i0; i <= i1; i++) {
        const x = minX + i * cell
        const u = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / det
        const v = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / det
        const w = 1 - u - v
        if (u < -1e-6 || v < -1e-6 || w < -1e-6) continue
        const y = u * ay + v * by + w * cy
        const k = j * nx + i
        if (!(grid[k] >= y)) grid[k] = y
      }
    }
  }

  // Fill the gaps from their neighbours, a few passes (a gap is a sliver, never a whole region).
  for (let pass = 0; pass < 4; pass++) {
    let missing = 0
    const next = grid.slice()
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        if (!Number.isNaN(grid[j * nx + i])) continue
        let sum = 0, n = 0
        for (let dj = -1; dj <= 1; dj++) {
          for (let di = -1; di <= 1; di++) {
            const ii = i + di, jj = j + dj
            if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue
            const h = grid[jj * nx + ii]
            if (!Number.isNaN(h)) { sum += h; n++ }
          }
        }
        if (n > 0) next[j * nx + i] = sum / n
        else missing++
      }
    }
    grid.set(next)
    if (missing === 0) break
  }

  const at = (i: number, j: number) => {
    const h = grid[Math.min(Math.max(j, 0), nz - 1) * nx + Math.min(Math.max(i, 0), nx - 1)]
    return Number.isNaN(h) ? fallback : h
  }
  return (x, z) => {
    const fx = (x - minX) / cell, fz = (z - minZ) / cell
    const i = Math.floor(fx), j = Math.floor(fz)
    const tx = fx - i, tz = fz - j
    const h0 = at(i, j) * (1 - tx) + at(i + 1, j) * tx
    const h1 = at(i, j + 1) * (1 - tx) + at(i + 1, j + 1) * tx
    return h0 * (1 - tz) + h1 * tz
  }
}

/** The height field of every mesh under `root`, in world space (the floor, whose stretch is baked into its file). */
export function heightFieldOf(root: Object3D, cell = 2): HeightField {
  root.updateWorldMatrix(true, true)
  const meshes: Mesh[] = []
  root.traverse((o) => {
    const mesh = o as Mesh
    if (mesh.isMesh && mesh.geometry.getAttribute('position')) meshes.push(mesh)
  })
  let vertices = 0, indices = 0
  for (const m of meshes) {
    vertices += m.geometry.getAttribute('position').count
    indices += m.geometry.index ? m.geometry.index.count : m.geometry.getAttribute('position').count
  }
  const positions = new Float32Array(vertices * 3)
  const index = new Uint32Array(indices)
  const v = new Vector3()
  let pv = 0, pi = 0
  for (const m of meshes) {
    const pos = m.geometry.getAttribute('position')
    const base = pv
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld)
      positions.set([v.x, v.y, v.z], (pv++) * 3)
    }
    if (m.geometry.index) for (let i = 0; i < m.geometry.index.count; i++) index[pi++] = base + m.geometry.index.getX(i)
    else for (let i = 0; i < pos.count; i++) index[pi++] = base + i
  }
  return buildHeightField(positions, index, cell)
}
