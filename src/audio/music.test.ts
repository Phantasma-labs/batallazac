import { describe, expect, it } from 'vitest'
import { FADE_SECONDS, MUSIC_DUCKED, MUSIC_LEVEL, fadeStep, musicTarget } from './music'

describe('map music', () => {
  it('plays only while the map plays and the sound is on, lower under the narration', () => {
    expect(musicTarget(true, false, false)).toBe(MUSIC_LEVEL)
    expect(musicTarget(true, false, true)).toBe(MUSIC_DUCKED)
    expect(musicTarget(false, false, false)).toBe(0) // paused, or a video is open
    expect(musicTarget(true, true, false)).toBe(0) // sound off
    expect(MUSIC_DUCKED).toBeLessThan(MUSIC_LEVEL)
  })

  it('fades up and down at a steady rate without overshooting', () => {
    let v = 0
    for (let i = 0; i < 60; i++) v = fadeStep(v, MUSIC_LEVEL, FADE_SECONDS / 60)
    expect(v).toBeCloseTo(MUSIC_LEVEL, 9)
    expect(fadeStep(v, MUSIC_LEVEL, 1)).toBe(MUSIC_LEVEL)
    expect(fadeStep(0.01, 0, 1)).toBe(0)
    expect(fadeStep(MUSIC_LEVEL, MUSIC_DUCKED, 0.1)).toBeGreaterThan(MUSIC_DUCKED)
  })
})
