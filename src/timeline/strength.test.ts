import { describe, expect, it } from 'vitest'
import { layoutOf } from '../scene/formation'
import { UNITS } from './events'
import { hm } from './model'
import { FULL_BARS, LOSSES, barsAt, lossRanks, presenceOf } from './strength'

describe('strength of the federal groups', () => {
  it('starts every unit at full strength, and the garrison of La Bufa never loses any', () => {
    for (const u of UNITS) expect(barsAt(u.id, hm(9)), u.id).toBe(FULL_BARS)
    expect(barsAt('fed-bufa', hm(19))).toBe(FULL_BARS)
    expect(LOSSES['fed-bufa']).toBeUndefined()
    expect(layoutOf('federal')).toHaveLength(FULL_BARS)
  })

  it('names only federal units, and each loss leaves fewer bars than before, in time order', () => {
    for (const [id, losses] of Object.entries(LOSSES)) {
      expect(UNITS.find((u) => u.id === id)?.track, id).toBe('federal')
      let bars = FULL_BARS
      let t = 0
      for (const l of losses) {
        expect(l.from, id).toBeGreaterThanOrEqual(t)
        expect(l.to, id).toBeGreaterThan(l.from)
        expect(l.bars, id).toBeLessThan(bars)
        bars = l.bars
        t = l.to
      }
    }
  })

  it('loses bars at each defeat: Loreto 11:00, La Sierpe 12:00, El Grillo 16:00 and the city centre 17:00', () => {
    expect(barsAt('fed-center', hm(10, 59))).toBe(FULL_BARS)
    expect(barsAt('fed-center', hm(11, 30))).toBeLessThan(FULL_BARS)
    expect(barsAt('fed-sierpe', hm(11, 59))).toBe(FULL_BARS)
    expect(barsAt('fed-sierpe', hm(12, 30))).toBeLessThan(FULL_BARS)
    expect(barsAt('fed-grillo', hm(15, 59))).toBe(FULL_BARS)
    expect(barsAt('fed-grillo', hm(16, 40))).toBeLessThan(FULL_BARS)
    for (const u of ['fed-center', 'fed-sierpe', 'fed-grillo']) expect(barsAt(u, hm(17, 30)), u).toBeLessThan(barsAt(u, hm(16, 59)))
  })

  it('shrinks smoothly while a defeat is under way', () => {
    const mid = barsAt('fed-center', hm(11, 15))
    expect(mid).toBeGreaterThan(12)
    expect(mid).toBeLessThan(FULL_BARS)
    expect(barsAt('fed-center', hm(11, 5))).toBeGreaterThan(mid)
  })

  it('leaves the federal army at half strength when the groups reach La Bufa at 17:45', () => {
    const federal = UNITS.filter((u) => u.track === 'federal')
    const total = federal.reduce((sum, u) => sum + barsAt(u.id, hm(17, 45)), 0)
    expect(total).toBe((federal.length * FULL_BARS) / 2)
  })

  it('takes the back line and the wings first, the middle of the front last', () => {
    const pieces = layoutOf('federal')
    const ranks = lossRanks(pieces)
    expect(new Set(ranks).size).toBe(pieces.length)
    const front = pieces.map((p, i) => ({ p, r: ranks[i] })).filter((x) => x.p.front.x === 0)
    const back = pieces.map((p, i) => ({ p, r: ranks[i] })).filter((x) => x.p.front.x < 0)
    expect(Math.max(...front.map((x) => x.r))).toBeLessThan(Math.min(...back.map((x) => x.r)))
    const centre = front.find((x) => Math.abs(x.p.front.z) < 1)!
    expect(centre.r).toBe(0)
  })

  it('shows a bar whole, gone, or shrinking', () => {
    expect(presenceOf(0, 6)).toBe(1)
    expect(presenceOf(5, 6)).toBe(1)
    expect(presenceOf(6, 6)).toBe(0)
    expect(presenceOf(5, 5.4)).toBeCloseTo(0.4, 9)
  })
})
