import { describe, expect, it } from 'vitest'
import { filmChanged, parseRange, partialResponse, routeOf } from './swLogic'

const ORIGIN = 'https://x'
const get = { method: 'GET', mode: 'no-cors' }

describe('routeOf', () => {
  it('routes a film', () => expect(routeOf(new URL('https://x/videos/natera.mp4'), get, ORIGIN)).toBe('film'))
  it('ignores a non-GET request', () => expect(routeOf(new URL('https://x/videos/natera.mp4'), { method: 'POST', mode: 'cors' }, ORIGIN)).toBe('ignore'))
  it('ignores another origin', () => expect(routeOf(new URL('https://other/videos/natera.mp4'), get, ORIGIN)).toBe('ignore'))
  it('routes a navigation as a page, whatever the query', () =>
    expect(routeOf(new URL('https://x/?lang=en'), { method: 'GET', mode: 'navigate' }, ORIGIN)).toBe('page'))
  it('routes other files as the app', () => expect(routeOf(new URL('https://x/assets/index-abc.js'), get, ORIGIN)).toBe('app'))
  it('does not treat subtitles as films', () => expect(routeOf(new URL('https://x/videos/natera.en.vtt'), get, ORIGIN)).toBe('app'))
})

describe('parseRange', () => {
  it('reads an open range', () => expect(parseRange('bytes=0-')).toEqual({ offset: 0 }))
  it('reads a closed range as offset and length', () => expect(parseRange('bytes=0-1')).toEqual({ offset: 0, length: 2 }))
  it('reads a suffix range', () => expect(parseRange('bytes=-500')).toEqual({ suffix: 500 }))
  it.each([null, 'bytes=0-1,5-9', 'items=0-1', 'bytes=a-b', 'bytes=5-2'])('gives up on %s', (header) => expect(parseRange(header)).toBeNull())
})

describe('partialResponse', () => {
  const bytes = Uint8Array.from({ length: 1000 }, (_, i) => i % 256)
  const blob = () => new Blob([bytes])

  it('answers the whole body with 200 when there is no range', async () => {
    const r = partialResponse(blob(), null)
    expect(r.status).toBe(200)
    expect(r.headers.get('content-length')).toBe('1000')
    expect(r.headers.get('accept-ranges')).toBe('bytes')
    expect(r.headers.get('content-type')).toBe('video/mp4')
    expect((await r.arrayBuffer()).byteLength).toBe(1000)
  })
  it('answers bytes=0- with a 206 of the whole body', () => {
    const r = partialResponse(blob(), 'bytes=0-')
    expect(r.status).toBe(206)
    expect(r.headers.get('content-range')).toBe('bytes 0-999/1000')
    expect(r.headers.get('accept-ranges')).toBe('bytes')
  })
  it('answers bytes=0-1 with the first two bytes', async () => {
    const r = partialResponse(blob(), 'bytes=0-1')
    expect(r.status).toBe(206)
    expect(r.headers.get('content-range')).toBe('bytes 0-1/1000')
    expect(r.headers.get('content-length')).toBe('2')
    expect([...new Uint8Array(await r.arrayBuffer())]).toEqual([0, 1])
  })
  it('answers a middle range with exactly those bytes', async () => {
    const r = partialResponse(blob(), 'bytes=300-305')
    expect([...new Uint8Array(await r.arrayBuffer())]).toEqual([...bytes.slice(300, 306)])
  })
  it('answers a suffix range', () => {
    const r = partialResponse(blob(), 'bytes=-10')
    expect(r.headers.get('content-range')).toBe('bytes 990-999/1000')
  })
  it('answers 416 for a range starting past the end', () => {
    const r = partialResponse(blob(), 'bytes=2000-')
    expect(r.status).toBe(416)
    expect(r.headers.get('content-range')).toBe('bytes */1000')
  })
  it('answers the whole body for a multi-range', () => {
    const r = partialResponse(blob(), 'bytes=0-1,5-9')
    expect(r.status).toBe(200)
  })
})

describe('filmChanged', () => {
  it('is false for the same etag', () => expect(filmChanged('"a"', '"a"')).toBe(false))
  it('is true for a different etag', () => expect(filmChanged('"a"', '"b"')).toBe(true))
  it('is false when the current etag is unknown', () => expect(filmChanged('"a"', null)).toBe(false))
  it('is true when nothing was stored', () => expect(filmChanged(null, '"b"')).toBe(true))
})
