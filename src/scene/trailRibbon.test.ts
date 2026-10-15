import { describe, expect, it } from 'vitest'
import { buildTrailRibbon, trailHalfWidth } from './trailRibbon'

const flat = () => 2
const line = [{ x: 0, y: 0, z: 0 }, { x: 30, y: 0, z: 0 }, { x: 60, y: 0, z: 40 }]

describe('trail ribbon', () => {
  it('has two vertices per path point, on either side, with a unit direction across the path', () => {
    const r = buildTrailRibbon(line, flat, 6, 1.5)
    expect(r.positions.length).toBe(line.length * 6)
    expect(Array.from(r.side)).toEqual([1, -1, 1, -1, 1, -1])
    for (let i = 0; i < line.length * 2; i++) expect(Math.hypot(r.across[i * 2], r.across[i * 2 + 1])).toBeCloseTo(1)
    // The first segment runs along +x, so across it is +z.
    expect(r.across[0]).toBeCloseTo(0)
    expect(Math.abs(r.across[1])).toBeCloseTo(1)
  })
  it('keeps the path point itself in x and z for both sides, and lifts the sampled ground', () => {
    const r = buildTrailRibbon(line, flat, 6, 1.5)
    expect([r.positions[0], r.positions[2], r.positions[3], r.positions[5]]).toEqual([0, 0, 0, 0])
    expect(r.positions[1]).toBeCloseTo(3.5)
    expect(r.positions[4]).toBeCloseTo(3.5)
  })
  it('samples the ground at the strip edges, so each side follows its own height', () => {
    const slope = (_x: number, z: number) => z * 0.5
    const r = buildTrailRibbon([{ x: 0, y: 0, z: 0 }, { x: 40, y: 0, z: 0 }], slope, 10, 0)
    expect(Math.abs(r.positions[1] - r.positions[4])).toBeCloseTo(10)
  })
  it('runs along from 0 to 1 by length', () => {
    const r = buildTrailRibbon(line, flat, 6, 0)
    expect(r.length).toBeCloseTo(30 + 50)
    expect(r.along[0]).toBe(0)
    expect(r.along[2]).toBeCloseTo(30 / 80)
    expect(r.along[4]).toBeCloseTo(1)
  })
  it('indexes two triangles per segment', () => {
    expect(buildTrailRibbon(line, flat, 6, 0).index.length).toBe((line.length - 1) * 6)
  })
  it('needs two points', () => {
    expect(() => buildTrailRibbon([{ x: 0, y: 0, z: 0 }], flat, 6, 0)).toThrow()
  })
  it('keeps its screen width within limits', () => {
    expect(trailHalfWidth(0.5, 7)).toBeCloseTo(3.5)
    expect(trailHalfWidth(0.01, 7, 1.8, 9)).toBe(1.8)
    expect(trailHalfWidth(100, 7, 1.8, 9)).toBe(9)
  })
})
