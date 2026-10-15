import { describe, expect, it } from 'vitest'
import { CHEVRON_PAINT, CHEVRON_SPACING, MAX_CHEVRON, MIN_ARROW_WIDTHS, MIN_CHEVRON, chevronOutline, chevronPeriod, chevronWidth } from './chevronArrow'

/** Point in polygon (even-odd). */
function inside(poly: readonly [number, number][], x: number, y: number): boolean {
  let hit = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit
  }
  return hit
}

describe('chevron outline', () => {
  const outline = chevronOutline()

  it('is six points, symmetric about the arrow and one unit wide', () => {
    expect(outline).toHaveLength(6)
    const across = outline.map((p) => p[1])
    expect(Math.max(...across)).toBeCloseTo(0.5, 6)
    expect(Math.min(...across)).toBeCloseTo(-0.5, 6)
    // The tip and the notch are on the axis; the ends of the arms mirror each other.
    expect(outline[0][1]).toBeCloseTo(0, 9)
    expect(outline[3][1]).toBeCloseTo(0, 9)
    expect(outline[1][0]).toBeCloseTo(outline[5][0], 9)
    expect(outline[1][1]).toBeCloseTo(-outline[5][1], 9)
    expect(outline[2][0]).toBeCloseTo(outline[4][0], 9)
    expect(outline[2][1]).toBeCloseTo(-outline[4][1], 9)
  })

  it('points toward the target, with its length centred on 0', () => {
    const along = outline.map((p) => p[0])
    expect(outline[0][0]).toBe(Math.max(...along)) // the tip leads
    expect(Math.max(...along) + Math.min(...along)).toBeCloseTo(0, 9)
    expect(Math.max(...along) - Math.min(...along)).toBeGreaterThan(0.4)
    expect(Math.max(...along) - Math.min(...along)).toBeLessThan(1)
  })

  it('is a chevron: solid along the axis at the tip, open ahead of the notch, and the arms are not as thick as the chevron is wide', () => {
    expect(inside(outline, 0, 0)).toBe(true)
    expect(inside(outline, outline[3][0] - 0.05, 0)).toBe(false) // behind the notch: the gap between the arms
    expect(inside(outline, outline[0][0] + 0.05, 0)).toBe(false) // ahead of the tip
    const arm = outline[1]
    expect(inside(outline, arm[0] + 0.02, arm[1] - 0.04)).toBe(true) // the end of an arm
    expect(inside(outline, 0.3, 0.45)).toBe(false) // outside the arm, ahead of it
  })
})

describe('chevron size', () => {
  it('keeps the same share of the screen however far the camera is, within limits', () => {
    // 1 world unit per pixel on a 768 px view: 0.086 of the height.
    expect(chevronWidth(1, 768, 1000)).toBeCloseTo(0.086 * 768, 6) // 66 world units
    // Twice as far: twice as many world units per pixel, but never more than MAX_CHEVRON.
    expect(chevronWidth(2, 768, 1000)).toBe(MAX_CHEVRON)
    // Close up: smaller in the world, the same on the screen.
    expect(chevronWidth(0.5, 768, 1000)).toBeCloseTo(33, 0)
  })

  it('is never so big that a short arrow shows no chevron at all', () => {
    expect(chevronWidth(1, 768, 90)).toBeCloseTo(90 / MIN_ARROW_WIDTHS, 9)
    expect(chevronWidth(1, 768, 300)).toBeLessThanOrEqual(300 / MIN_ARROW_WIDTHS)
  })

  it('is never thinner than the floor, nor than a third of a tiny arrow', () => {
    expect(chevronWidth(0.01, 768, 1000)).toBe(MIN_CHEVRON)
    expect(chevronWidth(0.01, 768, 15)).toBeCloseTo(15 / MIN_ARROW_WIDTHS, 9)
  })

  it('spaces the chevrons by the same ratio of their width', () => {
    expect(chevronPeriod(40)).toBeCloseTo(40 * CHEVRON_SPACING, 9)
    expect(CHEVRON_SPACING).toBeGreaterThan(1.2) // they never touch
  })
})

describe('chevron paint', () => {
  it('has a colour for each lane, as #rrggbb', () => {
    for (const lane of ['angeles', 'villa', 'federal']) expect(CHEVRON_PAINT[lane]).toMatch(/^#[0-9a-f]{6}$/i)
  })
})
