import { BufferAttribute, BufferGeometry, Group, Mesh } from 'three'
import { describe, expect, it } from 'vitest'
import { makeHeightIndex } from './heightIndex'

/** A mesh from flat vertex positions and triangle indices. */
function mesh(positions: number[], index?: number[]): Mesh {
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
  if (index) g.setIndex(index)
  return new Mesh(g)
}

// A square 0..100 whose height rises with x: y = x / 10.
const ramp = () => mesh([0, 0, 0, 100, 10, 0, 100, 10, 100, 0, 0, 100], [0, 2, 1, 0, 3, 2])

describe('height index', () => {
  const ground = makeHeightIndex(ramp())
  it('reads the height inside a triangle by interpolation', () => {
    expect(ground(50, 20)).toBeCloseTo(5)
    expect(ground(80, 90)).toBeCloseTo(8)
    expect(ground(0, 0)).toBeCloseTo(0)
  })
  it('gives the fallback off the board', () => {
    expect(makeHeightIndex(ramp(), 12, -3)(500, 0)).toBe(-3)
    expect(makeHeightIndex(ramp(), 12, -3)(50, -1)).toBe(-3)
  })
  it('agrees across cell borders, whatever the cell size', () => {
    for (const cell of [5, 12, 100]) {
      const g = makeHeightIndex(ramp(), cell)
      for (let x = 1; x < 100; x += 7.3) expect(g(x, 40)).toBeCloseTo(x / 10, 4)
    }
  })
  it('takes the highest surface where two overlap', () => {
    const low = ramp()
    const high = ramp()
    high.position.y = 4
    const root = new Group().add(low, high)
    expect(makeHeightIndex(root)(50, 20)).toBeCloseTo(9)
  })
  it('follows the meshes transforms', () => {
    const moved = ramp()
    moved.position.set(1000, 0, 0)
    expect(makeHeightIndex(moved)(1050, 20)).toBeCloseTo(5)
  })
  it('works on a mesh without an index', () => {
    const g = makeHeightIndex(mesh([0, 0, 0, 100, 10, 0, 0, 0, 100]))
    expect(g(20, 20)).toBeCloseTo(2)
  })
  it('is the fallback everywhere for an empty root', () => {
    expect(makeHeightIndex(new Group(), 12, 7)(0, 0)).toBe(7)
  })
})
