# Handover (2026-10-20)

For the next agent (or person) working on the Linux laptop clone. Read this first, then `README.md`; `docs/superpowers/progress/HANDOFF.md`
is the long history of the timeline work and is **partly stale** (see "Stale docs" below). The workstation (Windows, holds the Blender
and Resolve masters) answered the clone's `request.md` with this file; `request.md` is deleted.

## Where things stand

- Live site: `https://toma-zacatecas.phantasmalabs.com` (Cloudflare Worker `toma-zacatecas`; the old `toma-zacatecas.phantomvfx.workers.dev` also works).
- `master` on GitHub (`Phantasma-labs/batallazac`, public) is the single source of truth. Tests: 599 pass; `npm run typecheck` is clean.
- Five films play on the timeline, all Spanish: `felipe-angeles` (00:00, resumes at 10:00), `villistas` (12:00), `natera` (16:00), `zacatecas-centro` (17:00), `la-bufa` (19:00). Narration for the map is Spanish.
- **No English film exists.** The English page plays the Spanish films with English subtitles (`public/videos/*.en.vtt`). The earlier
  note that `videos/villistas-en.mp4` is expected was out of date; nothing in `src/` references it, so a 404 for it is correct.

## What is in git and what is not

| In git (a fresh clone runs) | Not in git |
|---|---|
| App source, tests, scripts, `worker/`, `wrangler.jsonc` | `public/videos/*.mp4` (git-ignored; 18-21 MB each, the repo is public) |
| `public/models` (4.4 MB), `public/audio`, `public/draco`, `public/extras`, posters (`.jpg`) and subtitles (`.vtt`) | Blender / Resolve masters (only on the workstation) |
| `_archive/**` sources (the retired statues' GLBs are ignored) | `dist/`, `.wrangler/`, `node_modules/` |

To see the films locally, download them from the live site into the git-ignored folder (the keys are the filenames in
`src/video/videos.ts`), e.g. `curl -o public/videos/natera.mp4 https://toma-zacatecas.phantasmalabs.com/videos/natera.mp4`. Without
them the app skips a missing film and carries on; `npm test` skips the film-file checks.

## Deploying (read before running `npm run deploy`)

- `npm run deploy` = build + `wrangler deploy`. The Worker (`worker/index.ts`) serves `/videos/*.mp4` **from the R2 bucket
  `toma-zacatecas-films`** (binding `FILMS`) with Range support (206/416), `Cache-Control: public, max-age=3600`, and falls back to the
  copy in `dist/` if a key is missing. Everything else is static assets (`public/_headers` sets their cache lifetimes).
- Deploy only replaces the Worker and the assets; it never touches the bucket's contents. A film change needs its own upload, from a
  machine that has the file:
  `npx wrangler r2 object put toma-zacatecas-films/videos/<name>.mp4 --file public/videos/<name>.mp4 --content-type video/mp4 --remote`
- You need `npx wrangler login` as the Cloudflare account that owns the Worker. No tokens or account ids are (or may be) in the repo.
  Use `npm run deploy:dry` to check a change without publishing.
- Do not change `wrangler.jsonc`'s `main`, `r2_buckets` or `assets.run_worker_first` without a reason: dropping them silently breaks the films.

## The PWA task the clone planned

The plan in the old `request.md` stands: manifest, 192/512/maskable PNG icons from `public/favicon.svg`, `apple-touch-icon`, a service
worker (precache app, models, audio; cache each film after first play; pass `Range` through) and an Install button; tablets and desktop,
no phones; films stay at `/videos/*` on the same origin. Things to watch, from reading the Worker and headers:

- The Cache API cannot store a 206. To cache a film, fetch it **without** a `Range` header (R2 returns 200 with `Content-Length`), put
  that, and answer `Range` requests from the cached body yourself (slice the blob, reply 206 with `Content-Range`). Otherwise Safari/iOS
  and seeking break.
- `/videos/*` goes through the Worker first (`run_worker_first`), so a new service-worker file under `public/` is served as a normal
  static asset: give `/sw.js` (and the manifest) `Cache-Control: no-cache` in `public/_headers`, or updates never reach tablets.
- Bump the cache name when models/audio change. The narration is `public/audio/narration-map-es-v3/`.
- Verify with `npm run build && npm run preview`, Lighthouse, and a Playwright tablet emulation. Do not deploy until the offline and
  seeking behaviour of a film has been checked in a real browser.

## Stale docs (known)

- `docs/superpowers/progress/HANDOFF.md` (2026-10-09/15) says the work is uncommitted, that `public/videos` is not git-ignored, and that
  only the 12:00 film has an English cut. All three are no longer true. Its description of the timeline, events, camera and units
  is otherwise the best map of `src/timeline/`, `src/video/` and `src/scene/`.
- `README.md`'s "Status" section still reads "Milestone 1 ... planned next"; the timeline, pins, films and bilingual page are built.

## Working agreements

- Commit small, push to `master`. Commit messages are `type: subject` (feat, fix, docs, test, chore).
- Never put secrets, API tokens or account ids in the repo (it is public). Third-party and AI-generated media are not under the MIT licence.
- Windows is case-insensitive: the component is `Force.tsx` because `Formation.tsx` collided with `formation.ts`. Avoid names that differ only by case.
- Models come from Blender exports (`npm run sync-assets`, needs `EXPORTS_DIR`); only the workstation has them. Do not expect to regenerate them on the clone.

## First five minutes

```bash
git pull --rebase
npm install
npm test && npm run typecheck
npm run dev        # http://localhost:5173
```
