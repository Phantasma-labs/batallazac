import { describe, expect, it } from 'vitest'
import { BODY_SCREEN, MAX_BODY, MIN_BODY, OUTLINE_POINTS, arrowOutline, arrowSpan, arrowStrip, bodyOpacity, bodyWidth, bowAmount, bowedPlan, lateralColumns, longness, resamplePlan } from './arrowShape'

const p = (x: number, z: number, y = 0) => ({ x, y, z })

describe('arrowOutline', () => {
  const o = arrowOutline(0, 300, 20)
  it('has the number of points the shader walks', () => {
    expect(o).toHaveLength(OUTLINE_POINTS)
  })
  it('starts at a point on the axis and ends at the tip on the axis', () => {
    expect(o[0]).toEqual({ s: 0, y: 0 })
    expect(o[o.length - 1]).toEqual({ s: 300, y: 0 })
  })
  it('swells from the tail to a body that is `body` wide', () => {
    const body = o.slice(1, 5)
    for (let i = 1; i < body.length; i++) expect(body[i].y).toBeGreaterThanOrEqual(body[i - 1].y)
    expect(body[body.length - 1].y).toBeCloseTo(10)
  })
  it('has barbs wider than the body, swept back from the tip', () => {
    const barb = o[o.length - 2]
    expect(barb.y).toBeGreaterThanOrEqual(o[o.length - 3].y * 2)
    expect(barb.s).toBeLessThan(o[o.length - 3].s)
    expect(barb.s).toBeLessThan(300)
  })
  it('keeps its proportions when the arrow is short or half grown', () => {
    const short = arrowOutline(0, 40, 20)
    const head = short[short.length - 2]
    expect(head.y).toBeLessThan(20)
    expect(40 - head.s).toBeLessThan(40 * 0.5)
  })
  it('follows the tail and tip it is given', () => {
    const t = arrowOutline(120, 300, 20)
    expect(t[0].s).toBe(120)
    expect(t[t.length - 1].s).toBe(300)
  })
})

describe('arrow size', () => {
  it('is a fixed share of the screen when the arrow is short on screen', () => {
    expect(bodyWidth(1, 768, 200)).toBeCloseTo(BODY_SCREEN * 768, 0)
    expect(bodyWidth(0.5, 768, 200 * 0.5)).toBeCloseTo(BODY_SCREEN * 768 * 0.5, 0)
  })
  it('thins out an arrow that crosses the whole frame', () => {
    expect(longness(100, 768)).toBe(0)
    expect(longness(2000, 768)).toBe(1)
    expect(longness(500, 768)).toBeGreaterThan(longness(300, 768))
    expect(bodyWidth(1, 768, 1000)).toBeLessThan(bodyWidth(1, 768, 200))
    expect(bodyOpacity(1)).toBeLessThan(bodyOpacity(0))
  })
  it('never swallows a hill in a close-up, nor draws a snake', () => {
    expect(bodyWidth(10, 768, 200)).toBe(MAX_BODY)
    expect(bodyWidth(0.01, 768, 400)).toBe(MIN_BODY)
    expect(bodyWidth(0.01, 768, 64)).toBeCloseTo(4)
  })
})

describe('bowedPlan', () => {
  it('stays straight for a short arrow and bows for a long one', () => {
    expect(bowAmount(100)).toBe(0)
    expect(bowAmount(1000)).toBeGreaterThan(0)
    expect(bowAmount(10000)).toBeLessThanOrEqual(80)
  })
  it('runs from the start to the target', () => {
    const plan = bowedPlan(p(0, 0, 3), p(100, 40, 9), 20)
    expect(plan[0]).toEqual(p(0, 0, 3))
    expect(plan[plan.length - 1].x).toBeCloseTo(100)
    expect(plan[plan.length - 1].z).toBeCloseTo(40)
    expect(plan[plan.length - 1].y).toBeCloseTo(9)
  })
  it('bows to the left of the way it travels: north for an arrow heading east', () => {
    const plan = bowedPlan(p(0, 0), p(100, 0), 20)
    const mid = plan[Math.floor(plan.length / 2)]
    expect(mid.z).toBeCloseTo(-20)
    expect(Math.min(...plan.map((q) => q.z))).toBeGreaterThanOrEqual(-20.0001)
  })
  it('is a straight line with no bulge', () => {
    for (const q of bowedPlan(p(0, 0), p(90, 30), 0)) expect(q.z).toBeCloseTo(q.x / 3)
  })
})

describe('arrowSpan', () => {
  it('runs the tip out to the target as the attack begins, and draws the tail in as it ends', () => {
    expect(arrowSpan(0, true, 100)).toEqual({ s0: 0, s1: 0 })
    expect(arrowSpan(1, true, 100)).toEqual({ s0: 0, s1: 100 })
    expect(arrowSpan(1, false, 100)).toEqual({ s0: 0, s1: 100 })
    expect(arrowSpan(0, false, 100)).toEqual({ s0: 100, s1: 100 })
    const half = arrowSpan(0.3, true, 100)
    expect(half.s0).toBe(0)
    expect(half.s1).toBeGreaterThan(30) // eases out: the tip is quick off the mark
    expect(half.s1).toBeLessThan(100)
    const out = arrowSpan(0.3, false, 100)
    expect(out.s1).toBe(100)
    expect(out.s0).toBeGreaterThan(0)
  })
})

describe('resamplePlan', () => {
  it('keeps every vertex and splits long gaps', () => {
    const out = resamplePlan([p(0, 0, 5), p(100, 0, 5), p(100, 30, 5)], 10)
    expect(out[0]).toEqual(p(0, 0))
    expect(out[out.length - 1]).toEqual(p(100, 30))
    expect(out.some((q) => q.x === 100 && q.z === 0)).toBe(true)
    for (let i = 1; i < out.length; i++) expect(Math.hypot(out[i].x - out[i - 1].x, out[i].z - out[i - 1].z)).toBeLessThanOrEqual(10.0001)
    for (const q of out) expect(q.y).toBe(0)
  })
})

describe('arrowStrip', () => {
  const plan = [p(0, 0), p(10, 0), p(20, 0)]
  const columns = lateralColumns(5)
  const s = arrowStrip(plan, columns)
  it('has the columns evenly from -1 to 1', () => {
    expect(columns).toEqual([-1, -0.5, 0, 0.5, 1])
  })
  it('has a vertex per column per point and two triangles per cell', () => {
    expect(s.along).toHaveLength(3 * 5)
    expect(s.index).toHaveLength(2 * 4 * 6)
  })
  it('measures the distance along the path and finds the sideways direction in the ground plane', () => {
    expect(s.length).toBe(20)
    expect(s.along[5]).toBe(10)
    expect(s.along[14]).toBe(20)
    // The path runs along +x, so its left (-tz, tx) is +z.
    expect([s.normals[0], s.normals[1]]).toEqual([-0, 1])
    expect([s.side[0], s.side[2], s.side[4]]).toEqual([-1, 0, 1])
  })
  it('has no heights: the shader reads them from the terrain', () => {
    for (let i = 1; i < s.positions.length; i += 3) expect(s.positions[i]).toBe(0)
  })
  it('needs two points', () => {
    expect(() => arrowStrip([p(0, 0)], columns)).toThrow()
  })
})
