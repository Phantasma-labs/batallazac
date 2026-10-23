# PWA: install and offline (design, 2026-10-22)

The plan comes from `HANDOVER.md` ("The PWA task the clone planned"); this spec fixes the decisions.

## Goal

The site installs as an app on tablets and desktop and keeps working offline, including each film once it has been played. Target use:
tablets and a museum kiosk PC. No phones.

## Constraints

- Films stay at `/videos/*` on the same origin, served by the Worker (`worker/index.ts`) from R2 with Range support. The Worker does not change.
- The repo is public: no secrets, tokens or account ids.
- No new dependencies (no Workbox, no vite-plugin-pwa).
- Do not deploy until offline use and seeking of a film have been checked in a real browser.

## Decisions

- A film is cached **after its first play**, not up front (about 100 MB per device otherwise).
- The Install button shows only where the browser offers `beforeinstallprompt` (Chromium). iPad users use Share, Add to Home Screen; the
  manifest and icons still apply.
- The service worker is registered in production builds only (`import.meta.env.PROD`).

## Design

### 1. Manifest and icons

- `public/manifest.webmanifest`: `name` "La Toma de Zacatecas", `short_name`, `display: standalone`, `orientation: landscape`,
  `theme_color` and `background_color` `#d9cdb4`, `start_url` and `scope` `./` (the build uses `base: './'`), icons below.
- PNGs generated from `public/favicon.svg` with ImageMagick and committed: `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`
  (full-bleed background, glyph inside the 80% safe zone, from `public/icon-maskable.svg`), `apple-touch-icon.png` (180).
- `index.html`: `<link rel="manifest">` and `<link rel="apple-touch-icon">`.

### 2. Service worker

`src/pwa/sw.ts`, emitted as an unhashed `/sw.js` (an extra Rollup input in `vite.config.ts`, `entryFileNames` special-cased for it). A small
Vite plugin (`writeBundle`) lists the files in `dist/` (everything except `videos/*.mp4` and `sw.js`) and writes that list and a build hash into
`sw.js` in place of a placeholder.

Caches:

| Cache | Content | Strategy |
|---|---|---|
| `app-<build hash>` | the listed files (JS/CSS, models, Draco, audio, extras, posters, subtitles, manifest, icons, about 11 MB) | precached on `install`; cache-first; older `app-*` caches deleted on `activate` |
| `page` | `index.html` | network-first, cache when offline |
| `films` | whole film bodies, keyed by URL, with the ETag | see below; **not** versioned, so a deploy never drops them |

Films (`/videos/*.mp4`):

1. Cached: serve from the stored body. A `Range` request gets a 206 with `Content-Range` (or 416 when out of range); no `Range` gets the 200.
2. Not cached: pass the request straight to the network (playback starts at once). In the background (`waitUntil`, one fetch in flight per
   film) fetch the whole film **without `Range`** (R2 answers 200 with `Content-Length`; the Cache API cannot store a 206) and store it.
3. Cached and online: a background `HEAD` compares the ETag with the stored one; on a difference, delete the entry and cache the new film.
   This keeps tablets from holding a film that was replaced under the same name.
4. Cached and offline: the stored body is all there is.

Everything else (other origins, non-GET) is not intercepted.

### 3. Headers

`public/_headers`: `/sw.js` and `/manifest.webmanifest` get `Cache-Control: no-cache`, so updates reach tablets. `index.html` already revalidates.

### 4. Install button

`src/pwa/install.ts` (hook over `beforeinstallprompt` / `appinstalled`, hidden when `display-mode: standalone` matches) and a button next
to the sound and language buttons; strings through `t(es, en)`.

### 5. Tests and verification

- Vitest, no browser: Range parsing and slicing a stored body into 206/416, the per-URL strategy choice, the ETag decision, the precache list
  builder.
- Real browser (Playwright against `npm run build && npm run preview`, the films downloaded from the live site into the git-ignored
  `public/videos/`): install the worker, play a film, go offline, reload, play the film again, seek in it; check the old `app-*` cache is
  dropped after a rebuild; tablet emulation; Lighthouse PWA check.

### 6. Docs

Update `README.md` (PWA section, Status), `HANDOVER.md` (PWA done; how it works; bumping the cache; stale-docs section trimmed),
`CLAUDE.md` (one line), and the stale claims in `docs/superpowers/progress/HANDOFF.md` (uncommitted work, videos not git-ignored,
only one English cut).

## Out of scope

Phones, push notifications, background sync, caching every film up front, an iOS install prompt, changes to the Worker.

## Risks

- The first play of a film downloads it twice (the range the player asks for, then the whole file in the background). Acceptable once per
  film per device.
- Storage quota: about 100 MB of films plus 11 MB of app. Browsers allow far more on tablets and desktop; a failed `put` is ignored and the
  film simply streams as before.
