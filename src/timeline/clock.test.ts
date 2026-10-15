import { describe, expect, it, vi } from 'vitest'
import { MINUTES_PER_SECOND, createClock } from './clock'
import { DAY_END, DAY_START, hm } from './model'
import { NARRATION } from './narrationLines'
import { PAUSE_SECONDS, STRETCHES } from './pacing'

describe('clock', () => {
  it('starts paused at the start of the day, midnight', () => {
    const c = createClock()
    expect(c.time).toBe(DAY_START)
    expect(DAY_START).toBe(0)
    expect(c.playing).toBe(false)
  })
  it('only advances while playing', () => {
    const c = createClock(hm(11), [])
    c.tick(10)
    expect(c.time).toBe(hm(11))
    c.play()
    c.tick(2)
    expect(c.time).toBe(hm(11) + 2 * MINUTES_PER_SECOND)
    c.pause()
    c.tick(2)
    expect(c.time).toBe(hm(11) + 2 * MINUTES_PER_SECOND)
  })
  it('speed scales playback', () => {
    const c = createClock(hm(11), [])
    c.setSpeed(4)
    c.play()
    c.tick(1)
    expect(c.time).toBe(hm(11) + 4 * MINUTES_PER_SECOND)
  })
  it('flies through the hours before the first shot: ten clock minutes to each minute of the strip', () => {
    const c = createClock()
    c.play()
    c.tick(2)
    expect(c.time).toBeCloseTo(2 * MINUTES_PER_SECOND * 10, 9)
    c.tick(13) // 60 bar minutes in all: the whole of 00:00 to 10:00
    expect(c.time).toBeCloseTo(hm(10), 9)
  })
  it('takes each stretch between two narration lines exactly as long as its line and the pause after it', () => {
    NARRATION.forEach((line, k) => {
      const c = createClock(line.at)
      c.play()
      c.tick(line.seconds + PAUSE_SECONDS - 0.01)
      expect(c.time, line.id).toBeLessThan(NARRATION[k + 1]?.at ?? DAY_END)
      c.tick(0.02)
      if (NARRATION[k + 1]) expect(c.time, line.id).toBeGreaterThan(NARRATION[k + 1].at)
      else expect(c.time).toBe(DAY_END)
    })
  })
  it('lands on the next line minute when the stretch is over, whatever the frame rate', () => {
    for (const dt of [1 / 144, 1 / 60, 1 / 20, 0.5]) {
      const c = createClock(NARRATION[0].at)
      c.play()
      const total = NARRATION[0].seconds + PAUSE_SECONDS
      let t = 0
      while (t + dt < total - 1e-9) {
        c.tick(dt)
        t += dt
      }
      c.tick(total - t)
      expect(c.time, `dt ${dt}`).toBeCloseTo(NARRATION[1].at, 6)
    }
  })
  it('plays the whole day from 10:00 in about a minute', () => {
    const c = createClock(hm(10))
    c.play()
    const seconds = STRETCHES.reduce((sum, s) => sum + s.seconds, 0)
    expect(seconds).toBeGreaterThan(50)
    expect(seconds).toBeLessThan(70)
    c.tick(seconds + 0.01)
    expect(c.time).toBe(DAY_END)
    expect(c.playing).toBe(false)
  })
  it('crosses a stretch edge in one tick without losing the time it has left over', () => {
    const stretches = [
      { from: 100, to: 200, seconds: 10, rate: 10 },
      { from: 200, to: 300, seconds: 2, rate: 50 },
    ]
    const c = createClock(190, stretches)
    c.play()
    c.tick(2) // one second gets to 200, the other is worth 50 minutes
    expect(c.time).toBeCloseTo(250, 9)
  })
  it('seeking clamps to the day and keeps playing', () => {
    const c = createClock()
    c.play()
    c.seek(-5)
    expect(c.time).toBe(DAY_START)
    c.seek(99999)
    expect(c.time).toBe(DAY_END)
    expect(c.playing).toBe(true)
  })
  it('stops at the end and restarts from the beginning on play', () => {
    const c = createClock()
    c.play()
    c.seek(DAY_END - 1)
    c.tick(100)
    expect(c.time).toBe(DAY_END)
    expect(c.playing).toBe(false)
    c.play()
    expect(c.time).toBe(DAY_START)
    expect(c.playing).toBe(true)
  })
  it('tells subscribers only when the minute, play state or speed changes', () => {
    const c = createClock(hm(11))
    const l = vi.fn()
    c.subscribe(l)
    c.play()
    expect(l).toHaveBeenCalledTimes(1)
    c.tick(0.01) // 0.04 minutes: same minute
    expect(l).toHaveBeenCalledTimes(1)
    c.tick(1) // crosses a minute
    expect(l.mock.calls.length).toBeGreaterThan(1)
  })
})
