import { BoxGeometry, Mesh, MeshBasicMaterial, PlaneGeometry } from 'three'
import { describe, expect, it } from 'vitest'
import { drape, makeGroundSampler } from './ground'

describe('ground sampler', () => {
  it('finds the height under a point and falls back off the board', () => {
    const slab = new Mesh(new BoxGeometry(100, 4, 100), new MeshBasicMaterial())
    slab.position.y = 8 // top face at y = 10
    const ground = makeGroundSampler(slab, -1)
    expect(ground(0, 0)).toBeCloseTo(10)
    expect(ground(49, -49)).toBeCloseTo(10)
    expect(ground(500, 0)).toBe(-1)
  })
  it('sees a tilted surface', () => {
    const plane = new Mesh(new PlaneGeometry(100, 100), new MeshBasicMaterial())
    plane.rotation.x = -Math.PI / 2
    plane.position.y = 3
    expect(makeGroundSampler(plane)(10, 10)).toBeCloseTo(3)
  })
})

describe('drape', () => {
  const flat = () => 5
  it('splits a line into steps and lifts it', () => {
    const line = drape([{ x: 0, y: 0, z: 0 }, { x: 30, y: 0, z: 0 }], flat, 10, 2)
    expect(line.map((p) => p.x)).toEqual([0, 10, 20, 30])
    expect(line.every((p) => p.y === 7)).toBe(true)
  })
  it('keeps every corner of a bent path', () => {
    const line = drape([{ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }, { x: 10, y: 0, z: 10 }], flat, 5)
    expect(line).toContainEqual({ x: 10, y: 5, z: 0 })
    expect(line[line.length - 1]).toEqual({ x: 10, y: 5, z: 10 })
  })
})
