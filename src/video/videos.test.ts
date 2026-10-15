import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { EVENTS } from '../timeline/events'
import { hm, type TimelineEvent } from '../timeline/model'
import { HOTSPOTS, VIDEO_FILES, VIDEO_SOURCES, fileIn, hotspotsOf, stopCrossed, windowAt, type Hotspot, type VideoFile } from './videos'

const publicDir = fileURLToPath(new URL('../../public', import.meta.url))
// The films are not in git (public repo, 95 MB): a clone has none, and there is nothing to check then.
const hasFilms = existsSync(join(publicDir, 'videos', 'natera.mp4'))
const file: VideoFile = { src: 'videos/x.mp4' }
const hotspot = (time: number, f: VideoFile | null = file, resumeAt = time): Hotspot => ({ eventId: `e${time}`, videoId: `v${time}`, time, resumeAt, file: f })
const ev = (id: string, time: number, video?: TimelineEvent['video']): TimelineEvent => ({
  id,
  track: 'villa',
  time,
  title: { es: id, en: id },
  text: { es: '', en: '' },
  source: 'inferred',
  video,
})

describe('hotspotsOf', () => {
  it('makes one hotspot per event that names a video, resuming where the event says or at its own minute', () => {
    const spots = hotspotsOf([ev('a', 0, { id: 'one', resumeAt: 600 }), ev('b', 100), ev('c', 720, { id: 'two' })], { one: file, two: file })
    expect(spots).toEqual([
      { eventId: 'a', videoId: 'one', time: 0, resumeAt: 600, file },
      { eventId: 'c', videoId: 'two', time: 720, resumeAt: 720, file },
    ])
  })
  it('keeps a placeholder (no file yet) as a hotspot with no file, and never mistakes an object key for a file', () => {
    const [none, odd] = hotspotsOf([ev('a', 720, { id: 'missing' }), ev('b', 960, { id: 'constructor' })], {})
    expect(none.file).toBeNull()
    expect(odd.file).toBeNull()
  })
  it('in the real day: the films at 00:00, 12:00, 16:00 and 17:00 play, the other hotspots are placeholders until their files are listed', () => {
    expect(HOTSPOTS.map((h) => [h.time, h.resumeAt, h.videoId, h.file !== null])).toEqual([
      [hm(0), hm(10), 'felipe-angeles', true],
      [hm(12), hm(12), 'villistas', true],
      [hm(16), hm(16), 'natera', true],
      [hm(17), hm(17), 'zacatecas-centro', true],
      [hm(19), hm(19), 'la-bufa', false],
      [hm(20), hm(20), 'battle-over', false],
    ])
    expect(HOTSPOTS.map((h) => h.eventId)).toEqual(EVENTS.filter((e) => e.video).map((e) => e.id))
  })
  it.skipIf(!hasFilms)('lists only files that exist in public/', () => {
    for (const [id, f] of Object.entries(VIDEO_FILES)) {
      expect(existsSync(join(process.cwd(), 'public', f.src)), `${id} video`).toBe(true)
      if (f.poster) expect(existsSync(join(process.cwd(), 'public', f.poster)), `${id} poster`).toBe(true)
    }
  })
})

describe('stopCrossed', () => {
  const spots = [hotspot(720), hotspot(960, null), hotspot(1020), hotspot(1140)]
  it('finds a playable hotspot the clock went past or reached, not one it started from', () => {
    expect(stopCrossed(700, 720, spots)?.time).toBe(720)
    expect(stopCrossed(700, 730, spots)?.time).toBe(720)
    expect(stopCrossed(720, 730, spots)).toBeNull()
  })
  it('opens only the earliest of several crossed in one big step', () => {
    expect(stopCrossed(0, 2000, spots)?.time).toBe(720)
    expect(stopCrossed(730, 2000, spots)?.time).toBe(1020)
  })
  it('skips placeholders and finds nothing in an empty or backwards step', () => {
    expect(stopCrossed(900, 1000, spots)).toBeNull()
    expect(stopCrossed(5, 5, spots)).toBeNull()
    expect(stopCrossed(800, 700, spots)).toBeNull()
    expect(stopCrossed(0, 10, [])).toBeNull()
  })
  it('never finds a hotspot at 00:00: nothing can cross the start of the day', () => {
    expect(stopCrossed(0, 100, [hotspot(0, file, 600)])).toBeNull()
    expect(stopCrossed(-1, 100, [hotspot(0, file, 600)])?.time).toBe(0)
  })
})

describe('windowAt', () => {
  const spots = [hotspot(0, file, 600), hotspot(720), hotspot(960, null, 960), hotspot(1100, null, 1130)]
  it('finds the film whose stretch the time is in, from its start up to where it resumes', () => {
    expect(windowAt(0, spots)?.time).toBe(0)
    expect(windowAt(300, spots)?.time).toBe(0)
    expect(windowAt(599.9, spots)?.time).toBe(0)
  })
  it('finds nothing at or after the resume point, nor at a hotspot that resumes where it plays', () => {
    expect(windowAt(600, spots)).toBeNull()
    expect(windowAt(720, spots)).toBeNull()
    expect(windowAt(960, spots)).toBeNull()
  })
  it('finds a stretch even when its file is missing (the caller then skips ahead)', () => {
    expect(windowAt(1110, spots)?.file).toBeNull()
  })
})

describe('videos by language', () => {
  const source = { src: 'a-es.mp4', poster: 'a.jpg', en: { src: 'a-en.mp4' } }
  it('plays the English cut on the English page, keeping the poster, and the Spanish one on the Spanish page', () => {
    expect(fileIn(source, 'en')).toEqual({ src: 'a-en.mp4', poster: 'a.jpg' })
    expect(fileIn(source, 'es')).toEqual({ src: 'a-es.mp4', poster: 'a.jpg' })
  })
  it('falls back to the Spanish file when there is no English cut', () => {
    expect(fileIn({ src: 'b.mp4', poster: 'b.jpg' }, 'en')).toEqual({ src: 'b.mp4', poster: 'b.jpg' })
  })
  it.skipIf(!hasFilms)('lists a file on disk for every cut of every video', () => {
    for (const s of Object.values(VIDEO_SOURCES)) for (const f of [s, s.en]) if (f) expect(existsSync(join(publicDir, f.src)), f.src).toBe(true)
  })
})
