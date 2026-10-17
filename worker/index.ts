import { contentRange, type R2Range } from './range'

/**
 * The page is static (Workers static assets, ./dist); this Worker only runs first for the films (`run_worker_first` in wrangler.jsonc).
 * The static-assets edge answers a Range request with the whole file (no 206), so a film could not seek and Safari/iOS may refuse it;
 * the films are served from the R2 bucket bound as FILMS instead, which answers ranges. A film missing from the bucket falls back to
 * the static copy in ./dist.
 */

type R2Object = { size: number; httpEtag: string; range?: R2Range; writeHttpMetadata(headers: Headers): void }
type R2ObjectBody = R2Object & { body: ReadableStream }
type Env = {
  ASSETS: { fetch(request: Request): Promise<Response> }
  FILMS: {
    get(key: string, options?: { range?: Headers }): Promise<R2ObjectBody | null>
    head(key: string): Promise<R2Object | null>
  }
}

const CACHE = 'public, max-age=3600'

function headersOf(object: R2Object): Headers {
  const headers = new Headers()
  object.writeHttpMetadata(headers)
  if (!headers.has('content-type')) headers.set('content-type', 'video/mp4')
  headers.set('etag', object.httpEtag)
  headers.set('accept-ranges', 'bytes')
  headers.set('cache-control', CACHE)
  return headers
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (!url.pathname.startsWith('/videos/') || !url.pathname.endsWith('.mp4')) return env.ASSETS.fetch(request)
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response(null, { status: 405, headers: { allow: 'GET, HEAD' } })
    const key = decodeURIComponent(url.pathname.slice(1)) // "videos/natera.mp4"

    if (request.method === 'HEAD') {
      const object = await env.FILMS.head(key)
      if (!object) return env.ASSETS.fetch(request)
      const headers = headersOf(object)
      headers.set('content-length', String(object.size))
      return new Response(null, { headers })
    }

    const ranged = request.headers.has('range')
    let object: R2ObjectBody | null
    try {
      object = await env.FILMS.get(key, ranged ? { range: request.headers } : undefined)
    } catch {
      // A range R2 cannot satisfy (past the end of the file).
      const whole = await env.FILMS.head(key)
      return new Response(null, { status: 416, headers: whole ? { 'content-range': `bytes */${whole.size}` } : {} })
    }
    if (!object) return env.ASSETS.fetch(request)
    const headers = headersOf(object)
    if (ranged && object.range) {
      headers.set('content-range', contentRange(object.range, object.size))
      return new Response(object.body, { status: 206, headers })
    }
    headers.set('content-length', String(object.size))
    return new Response(object.body, { headers })
  },
}
