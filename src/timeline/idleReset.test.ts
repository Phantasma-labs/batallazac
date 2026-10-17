import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createClock } from './clock'
import { IDLE_RESET_MS, watchIdleReset } from './idleReset'
import { DAY_END, DAY_START, hm } from './model'

const make = (start: number) => {
  const clock = createClock(start)
  const listeners = new Set<() => void>()
  const playback = {
    current: null as unknown,
    subscribe: (l: () => void) => (listeners.add(l), () => listeners.delete(l)),
  }
  const source = new EventTarget()
  const stop = watchIdleReset(clock, playback, source)
  return { clock, playback, source, stop, listeners }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('the reset after the day is over', () => {
  it('sends the clock back to the start 10 seconds after 20:00', () => {
    const { clock } = make(DAY_END)
    vi.advanceTimersByTime(IDLE_RESET_MS - 1)
    expect(clock.time).toBe(DAY_END)
    vi.advanceTimersByTime(1)
    expect(clock.time).toBe(DAY_START)
    expect(clock.playing).toBe(false)
  })

  it('counts from the moment a playing clock reaches 20:00', () => {
    const { clock } = make(DAY_END - 0.5)
    clock.play()
    clock.tick(5) // goes across 20:00 and stops
    expect(clock.playing).toBe(false)
    vi.advanceTimersByTime(IDLE_RESET_MS)
    expect(clock.time).toBe(DAY_START)
  })

  it('moves the seek counter, so the camera director takes the camera back', () => {
    const { clock } = make(DAY_END)
    const before = clock.seeks
    vi.advanceTimersByTime(IDLE_RESET_MS)
    expect(clock.seeks).toBe(before + 1)
  })

  it('waits another 10 seconds after any input', () => {
    const { clock, source } = make(DAY_END)
    vi.advanceTimersByTime(8000)
    source.dispatchEvent(new Event('pointerdown'))
    vi.advanceTimersByTime(8000)
    expect(clock.time).toBe(DAY_END)
    vi.advanceTimersByTime(2000)
    expect(clock.time).toBe(DAY_START)
  })

  it('does nothing before 20:00', () => {
    const { clock } = make(hm(14))
    vi.advanceTimersByTime(IDLE_RESET_MS * 3)
    expect(clock.time).toBe(hm(14))
  })

  it('does not run while a video is open, and starts counting when it closes', () => {
    const { clock, playback, listeners } = make(DAY_END)
    playback.current = { hotspot: 'x' }
    listeners.forEach((l) => l())
    vi.advanceTimersByTime(IDLE_RESET_MS * 3)
    expect(clock.time).toBe(DAY_END)
    playback.current = null
    listeners.forEach((l) => l())
    vi.advanceTimersByTime(IDLE_RESET_MS)
    expect(clock.time).toBe(DAY_START)
  })

  it('gives up the wait when someone presses play at 20:00', () => {
    const { clock } = make(DAY_END)
    vi.advanceTimersByTime(5000)
    clock.play() // starts the day over
    vi.advanceTimersByTime(IDLE_RESET_MS * 3)
    expect(clock.time).toBe(DAY_START)
    expect(clock.playing).toBe(true)
  })

  it('stops watching when disposed', () => {
    const { clock, stop } = make(DAY_END)
    stop()
    vi.advanceTimersByTime(IDLE_RESET_MS * 3)
    expect(clock.time).toBe(DAY_END)
  })
})
