import { describe, expect, it, vi } from 'vitest'
import { createClock } from '../timeline/clock'
import { DAY_END, hm } from '../timeline/model'
import { createPlayback } from './playback'
import type { Hotspot } from './videos'

const file = { src: 'videos/x.mp4' }
/** The film at 00:00 (resumes at 10:00), a video at noon and a placeholder at 16:00. */
const SPOTS: Hotspot[] = [
  { eventId: 'intro', videoId: 'intro', time: 0, resumeAt: hm(10), file },
  { eventId: 'noon', videoId: 'noon', time: hm(12), resumeAt: hm(12), file },
  { eventId: 'four', videoId: 'four', time: hm(16), resumeAt: hm(16), file: null },
]
const make = (start = 0, spots: readonly Hotspot[] = SPOTS) => {
  const clock = createClock(start)
  return { clock, playback: createPlayback(clock, spots) }
}
type Rig = ReturnType<typeof make>
/** One frame of the Director: tick the clock, then tell playback what it went across. */
const frame = ({ clock, playback }: Rig, seconds: number) => {
  const before = clock.time
  clock.tick(seconds)
  playback.afterTick(before, clock.time)
}

describe('the film at the start of the day', () => {
  it('opens when Play is pressed anywhere in 00:00 to 10:00, with the clock stopped', () => {
    const { clock, playback } = make()
    playback.toggle()
    expect(playback.current?.hotspot.videoId).toBe('intro')
    expect(playback.current?.resume).toBe(true)
    expect(clock.playing).toBe(false)
    expect(clock.time).toBe(0)
    const mid = make(hm(5))
    mid.playback.toggle()
    expect(mid.playback.current?.hotspot.videoId).toBe('intro')
  })
  it('hands over to 10:00 with the clock running when it ends or is skipped or fails (all close it)', () => {
    const { clock, playback } = make()
    playback.toggle()
    playback.close()
    expect(playback.current).toBeNull()
    expect(clock.time).toBe(hm(10))
    expect(clock.playing).toBe(true)
  })
  it('is not opened by scrubbing into its stretch, nor by the clock running through it', () => {
    const rig = make(hm(3))
    rig.clock.play()
    frame(rig, 1)
    expect(rig.playback.current).toBeNull()
    expect(rig.clock.playing).toBe(true)
  })
  it('is skipped to 10:00 when its file is missing', () => {
    const { clock, playback } = make(0, [{ ...SPOTS[0], file: null }, ...SPOTS.slice(1)])
    playback.toggle()
    expect(playback.current).toBeNull()
    expect(clock.time).toBe(hm(10))
    expect(clock.playing).toBe(true)
  })
  it('plays again when Play is pressed at the end of the day, which starts over', () => {
    const { clock, playback } = make()
    clock.seek(DAY_END)
    playback.toggle()
    expect(playback.current?.hotspot.videoId).toBe('intro')
    expect(clock.time).toBe(0)
  })
})

describe('Play and pause', () => {
  it('plays plainly from 10:00 on, and pauses when pressed while running', () => {
    const { clock, playback } = make(hm(10))
    playback.toggle()
    expect(playback.current).toBeNull()
    expect(clock.playing).toBe(true)
    playback.toggle()
    expect(clock.playing).toBe(false)
  })
})

describe('a hotspot the clock runs into', () => {
  it('stops exactly at its minute, opens its video, and carries on from there when it ends', () => {
    const rig = make(hm(11, 59))
    rig.clock.play()
    frame(rig, 1) // would reach 12:12
    expect(rig.playback.current?.hotspot.videoId).toBe('noon')
    expect(rig.clock.time).toBe(hm(12))
    expect(rig.clock.playing).toBe(false)
    rig.playback.close()
    expect(rig.clock.time).toBe(hm(12))
    expect(rig.clock.playing).toBe(true)
    frame(rig, 1)
    expect(rig.playback.current).toBeNull()
    expect(rig.clock.time).toBeGreaterThan(hm(12))
  })
  it('is ignored when it is a placeholder with no video yet', () => {
    const rig = make(hm(15, 59))
    rig.clock.play()
    frame(rig, 1)
    expect(rig.playback.current).toBeNull()
    expect(rig.clock.playing).toBe(true)
    expect(rig.clock.time).toBeGreaterThan(hm(16))
  })
})

describe('a click on a tick', () => {
  it('opens a video tick and afterwards leaves the clock as it was: stopped if it was stopped', () => {
    const { clock, playback } = make(hm(5))
    playback.jump(hm(12))
    expect(playback.current?.hotspot.videoId).toBe('noon')
    expect(playback.current?.resume).toBe(false)
    expect(clock.time).toBe(hm(12))
    playback.close()
    expect(clock.time).toBe(hm(12))
    expect(clock.playing).toBe(false)
  })
  it('keeps running afterwards if the clock was running', () => {
    const { clock, playback } = make(hm(11))
    clock.play()
    playback.jump(hm(12))
    expect(clock.playing).toBe(false)
    playback.close()
    expect(clock.playing).toBe(true)
  })
  it('only moves the clock for an info tick or a placeholder', () => {
    const { clock, playback } = make(hm(5))
    playback.jump(hm(11))
    expect(playback.current).toBeNull()
    expect(clock.time).toBe(hm(11))
    playback.jump(hm(16))
    expect(playback.current).toBeNull()
    expect(clock.time).toBe(hm(16))
  })
  it('opens the film from its own tick at 00:00', () => {
    const { clock, playback } = make(hm(11))
    playback.jump(0)
    expect(playback.current?.hotspot.videoId).toBe('intro')
    expect(clock.time).toBe(0)
    playback.close()
    expect(clock.time).toBe(hm(10))
  })
})

describe('while a video is open', () => {
  it('ignores Play, a tick click and the clock crossing another hotspot', () => {
    const rig = make(hm(5))
    rig.playback.jump(hm(12))
    const open = rig.playback.current
    rig.playback.toggle()
    rig.playback.jump(hm(11))
    rig.playback.jump(0)
    rig.playback.afterTick(hm(11), hm(13))
    expect(rig.playback.current).toBe(open)
    expect(rig.clock.time).toBe(hm(12))
    expect(rig.clock.playing).toBe(false)
  })
  it('does nothing when closed with nothing open', () => {
    const { clock, playback } = make(hm(11))
    playback.close()
    expect(clock.time).toBe(hm(11))
    expect(clock.playing).toBe(false)
  })
  it('gives each opening its own token, so the same video can run twice', () => {
    const { playback } = make(hm(5))
    playback.jump(hm(12))
    const first = playback.current!.token
    playback.close()
    playback.jump(hm(12))
    expect(playback.current!.token).not.toBe(first)
  })
})

describe('subscribers', () => {
  it('hear when a video opens and when it closes, and the snapshot is the open one', () => {
    const { playback } = make()
    const heard = vi.fn()
    const off = playback.subscribe(heard)
    playback.toggle()
    expect(heard).toHaveBeenCalledTimes(1)
    expect(playback.snapshot()).toBe(playback.current)
    playback.close()
    expect(heard).toHaveBeenCalledTimes(2)
    expect(playback.snapshot()).toBeNull()
    off()
    playback.jump(hm(12))
    expect(heard).toHaveBeenCalledTimes(2)
  })
})
