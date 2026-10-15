import { describe, expect, it } from 'vitest'
import { discGrid } from './glowDisc'

describe('discGrid', () => {
  const g = discGrid(50, 4, 12)
  it('has a centre vertex and a ring of vertices per ring', () => {
    expect(g.positions.length / 3).toBe(1 + 4 * 12)
    expect(g.uv.length / 2).toBe(1 + 4 * 12)
    expect([g.positions[0], g.positions[1], g.positions[2]]).toEqual([0, 0, 0])
  })
  it('reaches the radius on its outer ring and stays flat', () => {
    let far = 0
    for (let i = 0; i < g.positions.length / 3; i++) {
      far = Math.max(far, Math.hypot(g.positions[i * 3], g.positions[i * 3 + 2]))
      expect(g.positions[i * 3 + 1]).toBe(0)
    }
    expect(far).toBeCloseTo(50)
  })
  it('maps the centre to the middle of the texture and the rim to its inscribed circle', () => {
    expect([g.uv[0], g.uv[1]]).toEqual([0.5, 0.5])
    const last = (g.positions.length / 3 - 1) * 2
    expect(Math.hypot(g.uv[last] - 0.5, g.uv[last + 1] - 0.5)).toBeCloseTo(0.5)
  })
  it('is made of triangles that only use vertices that exist', () => {
    expect(g.index.length % 3).toBe(0)
    expect(g.index.length / 3).toBe(12 + (4 - 1) * 12 * 2)
    for (const i of g.index) expect(i).toBeLessThan(g.positions.length / 3)
  })
})
