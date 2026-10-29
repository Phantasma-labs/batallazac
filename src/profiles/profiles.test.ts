import { describe, expect, it, vi } from 'vitest'
import { createClock } from '../timeline/clock'
import { DAY_END, hm } from '../timeline/model'
import { createProfiles } from './profiles'

/** A clock, a stand-in for the film playback (`current` set means a film is open) and the profiles over them. */
const make = (start = hm(12), playing = false) => {
  const clock = createClock(start)
  if (playing) clock.play()
  const playback = { current: null as unknown }
  return { clock, playback, profiles: createProfiles(clock, playback) }
}

describe('opening a profile', () => {
  it('pauses the day where it is and remembers that it was playing', () => {
    const { clock, profiles } = make(hm(12), true)
    profiles.open('villa')
    expect(clock.playing).toBe(false)
    expect(clock.time).toBe(hm(12))
    expect(profiles.current).toEqual({ id: 'villa', resume: true, token: 1 })
  })

  it('on a day that was already paused remembers that too', () => {
    const { profiles } = make()
    profiles.open('natera')
    expect(profiles.current?.resume).toBe(false)
  })

  it('is ignored while a film is open', () => {
    const { clock, playback, profiles } = make(hm(12), true)
    playback.current = {}
    profiles.open('angeles')
    expect(profiles.current).toBeNull()
    expect(clock.playing).toBe(true)
  })

  it('is ignored while a panel is open (the first one stays, with its token)', () => {
    const { profiles } = make(hm(12), true)
    profiles.open('angeles')
    profiles.open('villa')
    expect(profiles.current).toEqual({ id: 'angeles', resume: true, token: 1 })
  })
})

describe('closing it', () => {
  it('puts the day back as it was: the clock runs on from the same minute, with no seek', () => {
    const { clock, profiles } = make(hm(12), true)
    profiles.open('villa')
    const seeksBefore = clock.seeks
    profiles.close()
    expect(profiles.current).toBeNull()
    expect(clock.playing).toBe(true)
    expect(clock.time).toBe(hm(12))
    expect(clock.seeks).toBe(seeksBefore + 1) // only play() counts; nothing moved the clock
  })

  it('leaves a paused day paused', () => {
    const { clock, profiles } = make()
    profiles.open('angeles')
    profiles.close()
    expect(clock.playing).toBe(false)
    expect(clock.time).toBe(hm(12))
  })

  it('at the very end of the day does not start it over', () => {
    const { clock, profiles } = make(DAY_END)
    profiles.open('natera')
    profiles.close()
    expect(clock.time).toBe(DAY_END)
    expect(clock.playing).toBe(false)
  })

  it('does nothing when nothing is open', () => {
    const { clock, profiles } = make(hm(12), true)
    const listener = vi.fn()
    profiles.subscribe(listener)
    profiles.close()
    expect(listener).not.toHaveBeenCalled()
    expect(clock.playing).toBe(true)
  })
})

describe('opening the same general again', () => {
  it('is a new opening (a new token, so the clip starts from its first frame)', () => {
    const { profiles } = make()
    profiles.open('villa')
    profiles.close()
    profiles.open('villa')
    expect(profiles.current?.token).toBe(2)
  })

  it('tells subscribers on every open and close, and not after they unsubscribe', () => {
    const { profiles } = make()
    const listener = vi.fn()
    const off = profiles.subscribe(listener)
    profiles.open('villa')
    profiles.close()
    expect(listener).toHaveBeenCalledTimes(2)
    off()
    profiles.open('villa')
    expect(listener).toHaveBeenCalledTimes(2)
  })
})
