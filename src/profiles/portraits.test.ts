import { describe, expect, it } from 'vitest'
import { VIDEO_SOURCES } from '../video/videos'
import { PORTRAIT_FILES, portraitOf } from './portraits'

describe('the portrait files', () => {
  it('have no entry for a general whose clip does not exist yet', () => {
    expect(portraitOf('villa')).toBeUndefined()
    expect(portraitOf('natera')).toBeUndefined()
  })

  it('point into videos/ and never share an id with a timeline film', () => {
    for (const [id, file] of Object.entries(PORTRAIT_FILES)) {
      expect(Object.hasOwn(VIDEO_SOURCES, id)).toBe(false)
      for (const path of [file.src, file.poster, file.thumb]) if (path) expect(path).toMatch(/^videos\/[a-z-]+\.(mp4|jpg)$/)
    }
  })
})
