import { BoxGeometry, Mesh, MeshBasicMaterial, PlaneGeometry } from 'three'
import { describe, expect, it } from 'vitest'
import { buildHeightField, heightFieldOf } from './heightField'

/** A 100 x 100 square on the ground plane whose height is 0.5 * x, as two triangles. */
const ramp = [0, 0, 0, 100, 50, 0, 0, 0, 100, 100, 50, 0, 100, 50, 100, 0, 0, 100]

describe('height field', () => {
  it('reads a flat surface everywhere inside it and clamps outside', () => {
    const flat = [0, 7, 0, 100, 7, 0, 0, 7, 100, 100, 7, 0, 100, 7, 100, 0, 7, 100]
    const h = buildHeightField(flat, null, 2)
    expect(h(10, 10)).toBeCloseTo(7)
    expect(h(99, 1)).toBeCloseTo(7)
    expect(h(-50, 40)).toBeCloseTo(7)
    expect(h(500, 500)).toBeCloseTo(7)
  })
  it('follows a slope, between nodes too', () => {
    const h = buildHeightField(ramp, null, 2)
    expect(h(20, 30)).toBeCloseTo(10, 1)
    expect(h(21.3, 77)).toBeCloseTo(10.65, 1)
    expect(h(100, 0)).toBeCloseTo(50, 1)
  })
  it('keeps the highest surface where triangles overlap', () => {
    const under = [0, 1, 0, 40, 1, 0, 0, 1, 40]
    const over = [0, 9, 0, 40, 9, 0, 0, 9, 40]
    expect(buildHeightField([...under, ...over], null, 2)(5, 5)).toBeCloseTo(9)
  })
  it('uses an index when given one', () => {
    const verts = [0, 3, 0, 40, 3, 0, 0, 3, 40, 40, 3, 40]
    expect(buildHeightField(verts, [0, 1, 2, 1, 3, 2], 2)(30, 30)).toBeCloseTo(3)
  })
  it('fills a gap between two pieces of surface from their edges', () => {
    const left = [0, 4, 0, 48, 4, 0, 0, 4, 100, 48, 4, 0, 48, 4, 100, 0, 4, 100]
    const right = [52, 4, 0, 100, 4, 0, 52, 4, 100, 100, 4, 0, 100, 4, 100, 52, 4, 100]
    expect(buildHeightField([...left, ...right], null, 2)(50, 30)).toBeCloseTo(4)
  })
  it('has a fallback when there is nothing', () => {
    expect(buildHeightField([], null, 2, -3)(0, 0)).toBe(-3)
  })
  it('reads the world-space heights of a mesh, with its transform', () => {
    const plane = new Mesh(new PlaneGeometry(100, 100, 4, 4), new MeshBasicMaterial())
    plane.rotation.x = -Math.PI / 2
    plane.position.y = 3
    expect(heightFieldOf(plane, 2)(10, -20)).toBeCloseTo(3)
    const box = new Mesh(new BoxGeometry(100, 4, 100), new MeshBasicMaterial())
    box.position.y = 8 // top face at 10
    expect(heightFieldOf(box, 2)(0, 0)).toBeCloseTo(10)
  })
})
