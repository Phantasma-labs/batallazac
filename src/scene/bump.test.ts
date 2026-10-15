import { describe, expect, it } from 'vitest'
import { DEFAULT_BUMP_SCALE, bumpScaleFromSearch, floorNormalMapUrl } from './bump'

describe('floorNormalMapUrl', () => {
  it('reads the normal map the floor file declares', () => {
    expect(floorNormalMapUrl({ stretchX: 1.679, normalMap: 'extras/floor_normal.webp' })).toBe('extras/floor_normal.webp')
  })
  it('is null for a floor that declares none (the framed board) or something that is not a path', () => {
    expect(floorNormalMapUrl(undefined)).toBeNull()
    expect(floorNormalMapUrl(null)).toBeNull()
    expect(floorNormalMapUrl({})).toBeNull()
    expect(floorNormalMapUrl({ normalMap: '' })).toBeNull()
    expect(floorNormalMapUrl({ normalMap: '  ' })).toBeNull()
    expect(floorNormalMapUrl({ normalMap: 5 })).toBeNull()
  })
})

describe('bumpScaleFromSearch', () => {
  it('defaults to a gentle bump', () => {
    expect(bumpScaleFromSearch('')).toBe(DEFAULT_BUMP_SCALE)
    expect(bumpScaleFromSearch('?cam=free')).toBe(DEFAULT_BUMP_SCALE)
    expect(DEFAULT_BUMP_SCALE).toBeGreaterThan(0)
    expect(DEFAULT_BUMP_SCALE).toBeLessThanOrEqual(2)
  })
  it('turns off with ?bump=off or 0, wherever it appears', () => {
    expect(bumpScaleFromSearch('?bump=off')).toBe(0)
    expect(bumpScaleFromSearch('?cam=free&bump=OFF')).toBe(0)
    expect(bumpScaleFromSearch('?bump=0')).toBe(0)
  })
  it('takes a strength, capped, and ignores nonsense', () => {
    expect(bumpScaleFromSearch('?bump=1.2')).toBe(1.2)
    expect(bumpScaleFromSearch('?bump=99')).toBe(3)
    expect(bumpScaleFromSearch('?bump=-1')).toBe(DEFAULT_BUMP_SCALE)
    expect(bumpScaleFromSearch('?bump=lots')).toBe(DEFAULT_BUMP_SCALE)
    expect(bumpScaleFromSearch('?bump=')).toBe(DEFAULT_BUMP_SCALE)
  })
})
