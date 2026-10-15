import { describe, expect, it } from 'vitest'
import { buildRibbon } from './ribbon'

const p = (x: number, y: number, z: number) => ({ x, y, z })

describe('buildRibbon', () => {
  const r = buildRibbon([p(0, 0, 0), p(10, 5, 0), p(20, 5, 0)], 4)
  it('has two vertices per point and two triangles per segment', () => {
    expect(r.positions).toHaveLength(3 * 2 * 3)
    expect(r.index).toHaveLength(2 * 6)
  })
  it('is as wide as asked, in the ground plane, at the path height', () => {
    // First point: path runs along +x, so the sides are at z = +-2.
    expect([r.positions[0], r.positions[1], r.positions[2]]).toEqual([0, 0, 2])
    expect([r.positions[3], r.positions[4], r.positions[5]]).toEqual([0, 0, -2])
    expect(r.positions[7]).toBe(5) // the climbing point keeps its height
  })
  it('records how far along each vertex is, by length', () => {
    const run = Math.hypot(10, 5)
    expect(r.length).toBeCloseTo(run + 10)
    expect(r.along[0]).toBe(0)
    expect(r.along[2]).toBeCloseTo(run / (run + 10))
    expect(r.along[4]).toBeCloseTo(1)
    expect([r.side[0], r.side[1]]).toEqual([1, -1])
  })
  it('needs two points', () => {
    expect(() => buildRibbon([p(0, 0, 0)], 1)).toThrow()
  })
})
