import { describe, expect, it } from 'vitest'
import { DAY_END, DAY_START, hm } from './model'
import { BAR_END, SQUEEZES, advanceBar, fromBar, toBar } from './timeScale'

describe('time scale', () => {
  it('squeezes the stretch before the first shot (x10, laid out only) and 12:00 to 16:00 (x4, tagged x7) into one hour of bar each', () => {
    expect(SQUEEZES).toEqual([
      { from: hm(0), to: hm(10), factor: 10 },
      { from: hm(12), to: hm(16), factor: 4, tag: '×7' },
    ])
    expect(toBar(hm(10)) - toBar(hm(0))).toBe(60)
    expect(toBar(hm(16)) - toBar(hm(12))).toBe(60)
  })
  it('tags only the squeeze the clock plays through (00:00 to 10:00 is the film, so it has no tag)', () => {
    expect(SQUEEZES.filter((s) => s.tag).map((s) => s.tag)).toEqual(['×7'])
  })
  it('keeps the hours in between at one bar minute per minute', () => {
    expect(toBar(hm(11)) - toBar(hm(10))).toBe(60)
    expect(toBar(hm(12)) - toBar(hm(11))).toBe(60)
    expect(toBar(hm(19, 30)) - toBar(hm(16))).toBe(210)
  })
  it('puts the day on a bar of 7.5 hours', () => {
    expect(toBar(DAY_START)).toBe(0)
    expect(toBar(DAY_END)).toBe(BAR_END)
    expect(BAR_END).toBe(480)
  })
  it('is increasing, and fromBar undoes toBar', () => {
    let last = -1
    for (let t = DAY_START; t <= DAY_END; t += 7) {
      const b = toBar(t)
      expect(b).toBeGreaterThan(last)
      last = b
      expect(fromBar(b)).toBeCloseTo(t, 9)
    }
  })
  it('clamps outside the day', () => {
    expect(toBar(-50)).toBe(0)
    expect(toBar(DAY_END + 500)).toBe(BAR_END)
    expect(fromBar(-5)).toBe(DAY_START)
    expect(fromBar(BAR_END + 99)).toBe(DAY_END)
  })
  it('works with no squeezes and with squeezes it is given', () => {
    expect(toBar(500, [])).toBe(500)
    expect(fromBar(500, [])).toBe(500)
    const one = [{ from: 100, to: 200, factor: 5 }]
    expect(toBar(300, one)).toBe(220)
    expect(fromBar(220, one)).toBe(300)
    expect(fromBar(10, one)).toBe(10)
  })
  it('advances along the bar twice as far through a paced squeeze, carrying what is left over across its edges', () => {
    const sq = [{ from: 100, to: 200, factor: 4, pace: 2 }]
    expect(advanceBar(50, 10, sq)).toBe(60)
    // 10 of budget get to the squeeze at bar 100, the other 5 are worth 10 bar minutes inside it.
    expect(advanceBar(90, 15, sq)).toBe(110)
    // The squeeze is 25 bar minutes long (ends at bar 125): 2 more cost 1 of budget, the other 4 go at the normal pace.
    expect(advanceBar(123, 5, sq)).toBe(129)
    expect(advanceBar(BAR_END - 1, 99)).toBe(BAR_END)
  })
})
