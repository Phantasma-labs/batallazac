import { contentRange, rangeBounds, type R2Range } from '../../worker/range'

/** What the service worker does with a request: a film (cached whole, ranges answered from it), the page, an app file, or nothing. */
export type Route = 'film' | 'page' | 'app' | 'ignore'

const FILM = /\/videos\/[^/]+\.mp4$/

export function routeOf(url: URL, request: { method: string; mode: string }, origin: string): Route {
  if (request.method !== 'GET' || url.origin !== origin) return 'ignore'
  if (FILM.test(url.pathname)) return 'film'
  return request.mode === 'navigate' ? 'page' : 'app'
}

/** The single byte range a `Range` header names; null for no header, several ranges or bad syntax (then the whole body is the answer). */
export function parseRange(header: string | null): R2Range | null {
  const m = header === null ? null : /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (!m || (m[1] === '' && m[2] === '')) return null
  if (m[1] === '') return { suffix: Number(m[2]) }
  const start = Number(m[1])
  if (m[2] === '') return { offset: start }
  const end = Number(m[2])
  return end < start ? null : { offset: start, length: end - start + 1 }
}

/** The answer to a request for `body`, honouring its `Range` header: 200 whole, 206 a part, 416 a range that starts past the end. */
export function partialResponse(body: Blob, rangeHeader: string | null, type = 'video/mp4'): Response {
  const size = body.size
  const headers = new Headers({ 'accept-ranges': 'bytes', 'content-type': type })
  const range = parseRange(rangeHeader)
  if (!range) {
    headers.set('content-length', String(size))
    return new Response(body, { headers })
  }
  const { start, end } = rangeBounds(range, size)
  if (start >= size || end < start) {
    headers.set('content-range', `bytes */${size}`)
    return new Response(null, { status: 416, headers })
  }
  headers.set('content-range', contentRange(range, size))
  headers.set('content-length', String(end - start + 1))
  return new Response(body.slice(start, end + 1), { status: 206, headers })
}

/** True when the film on the server is not the stored one. An unknown current etag (offline, no header) is not a change. */
export function filmChanged(storedEtag: string | null, currentEtag: string | null): boolean {
  return currentEtag !== null && currentEtag !== storedEtag
}
