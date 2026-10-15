import { describe, expect, it } from 'vitest'
import { BAR, CHEVRON, EDGE, GUN } from './formation'
import { chevronGeometry, chevronOutline, offsetPolygon, pieceGeometry } from './formationGeometry'

/** Twice the signed area: positive for a counter-clockwise polygon. */
const area = (pts: { x: number; y: number }[]) => pts.reduce((s, p, i) => s + (p.x * pts[(i + 1) % pts.length].y - pts[(i + 1) % pts.length].x * p.y), 0)
const box = (g: { computeBoundingBox(): void; boundingBox: { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } } | null }) => {
  g.computeBoundingBox()
  return g.boundingBox!
}

describe('formation geometry', () => {
  it('pushes a square outward by the offset on every side', () => {
    const square = [{ x: -1, y: -1 }, { x: 1, y: -1 }, { x: 1, y: 1 }, { x: -1, y: 1 }]
    const out = offsetPolygon(square, 0.5)
    expect(out.map((p) => [p.x, p.y])).toEqual([[-1.5, -1.5], [1.5, -1.5], [1.5, 1.5], [-1.5, 1.5]])
  })
  it('draws the chevron counter-clockwise, so its outline grows instead of shrinking', () => {
    const outline = chevronOutline()
    expect(area(outline)).toBeGreaterThan(0)
    expect(area(offsetPolygon(outline, EDGE))).toBeGreaterThan(area(outline))
  })
  it('points the chevron forward and centres it', () => {
    const xs = chevronOutline().map((p) => p.x)
    expect(Math.max(...xs)).toBeCloseTo(CHEVRON.len / 2)
    expect(Math.min(...xs)).toBeCloseTo(-CHEVRON.len / 2)
  })
  it('layers a bar: the painted top inside a cream edge inside an ink outline, each a little taller than the one outside it', () => {
    const { ink, cream, fill } = pieceGeometry('bar')
    const [i, c, f] = [box(ink), box(cream), box(fill)]
    expect(i.max.z - i.min.z).toBeCloseTo(BAR.len + 2 * EDGE)
    expect(c.max.z - c.min.z).toBeCloseTo(BAR.len + 2 * BAR.cream)
    expect(f.max.z - f.min.z).toBeCloseTo(BAR.len)
    expect(i.max.x - i.min.x).toBeCloseTo(BAR.depth + 2 * EDGE)
    expect(c.max.y).toBeGreaterThan(i.max.y)
    expect(f.max.y).toBeGreaterThan(c.max.y)
    // All sunk the same little way into the ground.
    expect(i.min.y).toBeCloseTo(f.min.y)
  })
  it('gives a gun a carriage like a bar and a barrel pointing forward, in the outline and the edge but not in the paint', () => {
    const { ink, cream, fill } = pieceGeometry('gun')
    expect(box(fill).max.x).toBeCloseTo(GUN.depth / 2)
    expect(box(ink).max.x).toBeCloseTo(GUN.barrelFrom + GUN.barrelLen, 0)
    expect(box(cream).max.x).toBeGreaterThan(GUN.depth / 2 + EDGE)
    expect(box(ink).min.x).toBeCloseTo(-(GUN.depth / 2 + EDGE))
  })
  it('builds the chevron layers around the same centre, the ink the widest', () => {
    const { ink, cream, fill } = chevronGeometry()
    expect(box(ink).max.z - box(ink).min.z).toBeGreaterThan(box(cream).max.z - box(cream).min.z)
    expect(box(cream).max.z - box(cream).min.z).toBeGreaterThan(box(fill).max.z - box(fill).min.z)
    expect(Math.abs(box(fill).max.x + box(fill).min.x)).toBeLessThan(1)
    expect(box(fill).max.y).toBeGreaterThan(box(ink).max.y)
  })
})
