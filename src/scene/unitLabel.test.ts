import { describe, expect, it } from 'vitest'
import { LABELS } from './labels'
import { keepOutRects, overlapArea, pickLabelSpot, type Rect } from './unitLabel'

const box: Rect = { x0: -100, x1: 100, z0: -20, z1: 20 }
const spot = (keepOut: Rect[], halfW = 60, halfH = 10) => pickLabelSpot(box, halfW, halfH, keepOut, { x: 0, z: 0 })

describe('overlap', () => {
  it('is the area two boxes share, and nothing when they only touch or miss', () => {
    expect(overlapArea({ x0: 0, x1: 10, z0: 0, z1: 10 }, { x0: 5, x1: 20, z0: 5, z1: 20 })).toBe(25)
    expect(overlapArea({ x0: 0, x1: 10, z0: 0, z1: 10 }, { x0: 10, x1: 20, z0: 0, z1: 10 })).toBe(0)
    expect(overlapArea({ x0: 0, x1: 10, z0: 0, z1: 10 }, { x0: 30, x1: 40, z0: 0, z1: 10 })).toBe(0)
  })
})

describe('where the unit label goes', () => {
  it('goes under the force when nothing is in the way', () => {
    const p = spot([])
    expect(p.x).toBe(0)
    expect(p.z).toBeGreaterThan(box.z1)
  })
  it('goes above it when a place name lies below', () => {
    const p = spot([{ x0: -150, x1: 150, z0: 20, z1: 80 }])
    expect(p.z).toBeLessThan(box.z0)
  })
  it('goes beside it when names lie above and below', () => {
    const p = spot([{ x0: -150, x1: 150, z0: 20, z1: 80 }, { x0: -150, x1: 150, z0: -80, z1: -20 }])
    expect(overlapArea({ x0: p.x - 60, x1: p.x + 60, z0: p.z - 10, z1: p.z + 10 }, { x0: -150, x1: 150, z0: 20, z1: 80 })).toBe(0)
    expect(overlapArea({ x0: p.x - 60, x1: p.x + 60, z0: p.z - 10, z1: p.z + 10 }, { x0: -150, x1: 150, z0: -80, z1: -20 })).toBe(0)
  })
  it('settles for the least overlap when it cannot clear every name', () => {
    const everywhere: Rect[] = [{ x0: -400, x1: 400, z0: -200, z1: 200 }]
    const p = spot(everywhere)
    expect(Number.isFinite(p.x) && Number.isFinite(p.z)).toBe(true)
  })
})

describe('the place names to keep clear of', () => {
  const places = new Map(LABELS.map((l, i) => [l.id, { x: i * 100, z: 50 }]))
  it('has a box for every name with a pin, wider than its letters', () => {
    const rects = keepOutRects(LABELS, places)
    expect(rects).toHaveLength(LABELS.length)
    LABELS.forEach((l, i) => {
      expect(rects[i].x1 - rects[i].x0).toBeGreaterThan(l.name.length * l.cap)
    })
  })
  it('hangs the box below its pin, and moves it with the name: sideways by `shift`, north by `rise`', () => {
    const spec = { id: 'a', name: 'Abc', cap: 10, tracking: 0.3 }
    const pin = new Map([['a', { x: 0, z: 0 }]])
    const [plain] = keepOutRects([spec], pin)
    expect(plain.z1).toBeGreaterThan(0)
    expect((plain.x0 + plain.x1) / 2).toBeCloseTo(0)
    const [moved] = keepOutRects([{ ...spec, shift: 40, rise: 100 }], pin)
    expect(moved.x0 - plain.x0).toBeCloseTo(40)
    expect(moved.x1 - moved.x0).toBeCloseTo(plain.x1 - plain.x0)
    expect(plain.z0 - moved.z0).toBeCloseTo(100) // north is -z
    expect(plain.z1 - plain.z0).toBeCloseTo(moved.z1 - moved.z0)
  })
  it('skips a name whose pin is unknown', () => {
    expect(keepOutRects(LABELS, new Map())).toEqual([])
  })
})
