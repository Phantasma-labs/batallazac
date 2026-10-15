import { describe, expect, it } from 'vitest'
import { cameraModeFromSearch, zoomFromSearch } from './mode'

describe('camera mode', () => {
  it('is the tripod camera unless asked for the free one', () => {
    expect(cameraModeFromSearch('')).toBe('locked')
    expect(cameraModeFromSearch('?cam=free')).toBe('free')
  })
  it('keeps the zoom off unless ?zoom=on', () => {
    expect(zoomFromSearch('')).toBe(false)
    expect(zoomFromSearch('?zoom=off')).toBe(false)
    expect(zoomFromSearch('?cam=locked')).toBe(false)
    expect(zoomFromSearch('?zoom=on')).toBe(true)
    expect(zoomFromSearch('?cam=locked&zoom=on')).toBe(true)
  })
})
