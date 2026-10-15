import { describe, expect, it } from 'vitest'
import { DEPTH_OF_FIELD, VIGNETTE, macroAmount, macroLook } from './macro'

describe('macroAmount', () => {
  it('is 0 in the wide shot and 1 at a statue lens', () => {
    expect(macroAmount(20.3, 20.3)).toBe(0)
    expect(macroAmount(20.3, 6.9)).toBe(1)
    expect(macroAmount(20.3, 6)).toBe(1)
  })
  it('eases in as the lens zooms, never leaving 0..1', () => {
    let last = 0
    for (let fov = 20.3; fov >= 5; fov -= 0.25) {
      const a = macroAmount(20.3, fov)
      expect(a).toBeGreaterThanOrEqual(last)
      expect(a).toBeLessThanOrEqual(1)
      last = a
    }
    expect(macroAmount(20.3, 12)).toBeGreaterThan(0)
    expect(macroAmount(20.3, 12)).toBeLessThan(1)
  })
  it('stays 0 for a lens wider than the wide shot or a degenerate fov', () => {
    expect(macroAmount(20, 30)).toBe(0)
    expect(macroAmount(0, 10)).toBe(0)
    expect(macroAmount(20, 0)).toBe(0)
    expect(macroAmount(NaN, 10)).toBe(0)
  })
})

describe('macroLook', () => {
  it('has no blur and the light vignette in the wide shot', () => {
    const look = macroLook(0)
    expect(look.bokehScale).toBe(0)
    expect(look.vignette).toBe(VIGNETTE.wide)
  })
  it('has the full blur and the close-up vignette in a close-up', () => {
    const look = macroLook(1)
    expect(look.bokehScale).toBe(DEPTH_OF_FIELD.bokehScale)
    expect(look.vignette).toBe(VIGNETTE.macro)
  })
  it('moves the vignette smoothly between the wide and the close-up value, whichever is stronger', () => {
    const lo = Math.min(VIGNETTE.wide, VIGNETTE.macro)
    const hi = Math.max(VIGNETTE.wide, VIGNETTE.macro)
    const mid = macroLook(0.5).vignette
    expect(mid).toBeGreaterThanOrEqual(lo)
    expect(mid).toBeLessThanOrEqual(hi)
    expect(mid).toBeCloseTo((VIGNETTE.wide + VIGNETTE.macro) / 2)
  })
  it('clamps an amount outside 0..1', () => {
    expect(macroLook(-1)).toEqual(macroLook(0))
    expect(macroLook(7)).toEqual(macroLook(1))
  })
})
