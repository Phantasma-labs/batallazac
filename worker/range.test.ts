import { describe, expect, it } from 'vitest'
import { contentRange, rangeBounds } from './range'

describe('rangeBounds', () => {
  it('reads an offset and a length', () => {
    expect(rangeBounds({ offset: 100, length: 50 }, 1000)).toEqual({ start: 100, end: 149 })
  })
  it('runs an open range to the end of the object', () => {
    expect(rangeBounds({ offset: 100 }, 1000)).toEqual({ start: 100, end: 999 })
  })
  it('takes the last bytes for a suffix range', () => {
    expect(rangeBounds({ suffix: 10 }, 1000)).toEqual({ start: 990, end: 999 })
  })
  it('clamps a suffix longer than the object', () => {
    expect(rangeBounds({ suffix: 5000 }, 1000)).toEqual({ start: 0, end: 999 })
  })
  it('ignores keys R2 sends as undefined', () => {
    expect(rangeBounds({ offset: 0, length: 1024, suffix: undefined }, 1000000)).toEqual({ start: 0, end: 1023 })
  })
  it('clamps a length past the end', () => {
    expect(rangeBounds({ offset: 900, length: 500 }, 1000)).toEqual({ start: 900, end: 999 })
  })
})

describe('contentRange', () => {
  it('writes the header of a 206 answer', () => {
    expect(contentRange({ offset: 0, length: 1024 }, 11321104)).toBe('bytes 0-1023/11321104')
  })
})
