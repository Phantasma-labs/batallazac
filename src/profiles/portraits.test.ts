import { describe, expect, it } from 'vitest'
import { VIDEO_SOURCES } from '../video/videos'
import { PORTRAIT_FILES, portraitOf } from './portraits'

describe('the portrait files', () => {
  it('list a clip for each of the three generals', () => {
    expect(portraitOf('angeles')?.src).toBe('videos/angeles-portrait.mp4')
    expect(portraitOf('villa')?.src).toBe('videos/villa-portrait.mp4')
    expect(portraitOf('natera')?.src).toBe('videos/natera-portrait.mp4')
  })

  it('point into videos/ and never reuse a timeline film file (a general may share a name with a film, e.g. natera)', () => {
    const films = new Set(Object.values(VIDEO_SOURCES).flatMap((s) => [s.src, s.poster]))
    for (const file of Object.values(PORTRAIT_FILES)) {
      for (const path of [file.src, file.poster, file.thumb]) {
        if (!path) continue
        expect(path).toMatch(/^videos\/[a-z-]+\.(mp4|jpg)$/)
        expect(films.has(path)).toBe(false)
      }
    }
  })
})
