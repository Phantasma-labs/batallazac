/// <reference lib="webworker" />
import { filmChanged, partialResponse, routeOf } from './swLogic'

/**
 * The service worker: the app works offline after one visit, and a film once it has been played.
 * - The app files (listed at build time by precachePlugin) are fetched on install into `app-<hash>`, answered cache-first; the
 *   page itself is network-first with the cached index.html as the offline fallback.
 * - A film is passed to the network the first time (so it starts at once) while the whole file is fetched without a Range header and
 *   stored in `films-v1` (the Cache API cannot store a 206). From then on the stored body answers every request, ranges included.
 */
declare const self: ServiceWorkerGlobalScope

// The two tokens are rewritten in dist/sw.js after the build (src/pwa/precachePlugin.ts).
const FILES = '__PRECACHE_FILES__'
const BUILD = '__BUILD_HASH__'
const APP = `app-${BUILD}`
const FILMS = 'films-v1'

const urlOf = (path: string) => new URL(path, self.registration.scope).href

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(APP)
      await cache.addAll(FILES.split('|').filter(Boolean).map((f) => new Request(urlOf(f), { cache: 'reload' })))
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key.startsWith('app-') && key !== APP) await caches.delete(key)
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  switch (routeOf(new URL(request.url), request, self.location.origin)) {
    case 'film':
      event.respondWith(film(event))
      break
    case 'page':
      event.respondWith(page(request))
      break
    case 'app':
      event.respondWith(app(request))
      break
  }
})

/** An app file from the cache (a range request, from an audio element, is answered with a 206 as Safari insists), else the network. */
async function app(request: Request): Promise<Response> {
  const stored = await (await caches.open(APP)).match(request, { ignoreSearch: true, ignoreVary: true })
  if (!stored) return fetch(request)
  const range = request.headers.get('range')
  return range ? partialResponse(await stored.blob(), range, stored.headers.get('content-type') ?? undefined) : stored
}

/** The page from the network; offline, the cached index.html whatever the query (?lang=en). */
async function page(request: Request): Promise<Response> {
  try {
    return await fetch(request)
  } catch {
    return (await (await caches.open(APP)).match(urlOf('index.html'), { ignoreVary: true })) ?? Response.error()
  }
}

const downloading = new Set<string>()
const checked = new Set<string>()

async function film(event: FetchEvent): Promise<Response> {
  const { request } = event
  const stored = await (await caches.open(FILMS)).match(request.url, { ignoreVary: true })
  if (!stored) {
    event.waitUntil(cacheFilm(request.url))
    return fetch(request)
  }
  event.waitUntil(revalidate(request.url, stored.headers.get('etag')))
  return partialResponse(await stored.blob(), request.headers.get('range'), stored.headers.get('content-type') ?? undefined)
}

/** Stores the whole film (one download at a time per film). A failure, offline or out of room, leaves no entry and is not an error. */
async function cacheFilm(url: string): Promise<void> {
  if (downloading.has(url)) return
  downloading.add(url)
  try {
    const response = await fetch(url, { cache: 'reload' })
    if (response.status === 200) await (await caches.open(FILMS)).put(url, response)
  } catch {
    // The film simply streams, as it did before.
  } finally {
    downloading.delete(url)
  }
}

/** Once per run of the worker, when online: a film replaced on the server under the same name is dropped and fetched again. */
async function revalidate(url: string, storedEtag: string | null): Promise<void> {
  if (checked.has(url)) return
  checked.add(url)
  try {
    const head = await fetch(url, { method: 'HEAD', cache: 'no-store' })
    if (head.ok && filmChanged(storedEtag, head.headers.get('etag'))) {
      await (await caches.open(FILMS)).delete(url)
      await cacheFilm(url)
    }
  } catch {
    // Offline: the stored film is all there is.
  }
}
