# Handover (2026-10-22)

For the next agent (or person) working on the Linux laptop clone. Read this first, then `README.md`; `docs/superpowers/progress/HANDOFF.md`
is the long history of the timeline work and is **partly stale** (see "Stale docs" below). The workstation (Windows, holds the Blender
and Resolve masters) answered the clone's `request.md` with this file; `request.md` is deleted.

## Where things stand

- Live site: `https://toma-zacatecas.phantasmalabs.com` (Cloudflare Worker `toma-zacatecas`; the old `toma-zacatecas.phantomvfx.workers.dev` also works).
- `master` on GitHub (`Phantasma-labs/batallazac`, public) is the single source of truth. Tests: 639 pass (after the PWA work); `npm run typecheck` is clean.
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

## The PWA (built 2026-10-22, not deployed yet)

Install and offline support are built (spec `docs/superpowers/specs/2026-10-22-pwa-design.md`, plan `docs/superpowers/plans/2026-10-22-pwa.md`,
work on the `pwa` branch). How it works, and how to change it safely, is in the README's "Install and offline (PWA)" section. In short: a
hand-written service worker (`src/pwa/sw.ts`, no dependencies) precaches the app (about 11 MB) under a cache name that is a hash of the
files, so nothing needs bumping by hand; each film is cached whole after its first play and its ranges are answered from the stored
body; an Install button shows where the browser offers one. The Worker, `wrangler.jsonc` and R2 are unchanged.

Checked with Playwright (Chromium) against `npm run build && npm run preview`, with the films downloaded from the live site:
- the first visit installs the worker and precaches 36 files; a film's first range request is served by the network and the whole file
  lands in `films-v1`;
- offline, the app boots in Spanish and English (`/`, `/?lang=en`, `/?lang=es`) with no console errors; the stored film answers
  `bytes=0-1`, `bytes=0-` and a middle range (206), `bytes=999999999-` (416) and a whole request (200); a `<video>` seeks to 20 s (readyState 4);
- a film never played cannot load offline (expected);
- after a rebuild that changes a precached file, the next reload installs the new worker, drops the old `app-*` cache and keeps `films-v1`;
- the Install button is absent until `beforeinstallprompt`, shows between the sound and language buttons, calls `prompt()` once and goes away;
- Chromium's installability check (CDP `Page.getInstallabilityErrors`) reports only `in-incognito` (the test browser is private), and the
  manifest parses with no errors. Lighthouse 12 no longer has a PWA category.

Not checked: Safari/iPadOS and real tablet hardware, and the Cloudflare-served build (the preview server was used). Before announcing it,
deploy (see above), open the live site once in Chrome and on an iPad, and repeat "play a film, go offline, reload, seek". One bug the
browser check caught is worth knowing: module scripts are CORS requests, and a server that answers `Vary: Origin` never matched the
cached copies until the lookups used `ignoreVary` (kept in `sw.ts`; the live Cloudflare assets may or may not send that header).

## Stale docs (known)

- `docs/superpowers/progress/HANDOFF.md` (2026-10-09/15) is history. Its description of the timeline, events, camera and units is still
  the best map of `src/timeline/`, `src/video/` and `src/scene/`; the claims about uncommitted work, `public/videos` not being git-ignored
  and an English film were corrected on 2026-10-22. Its `app/` paths belong to the old workspace layout and are not paths in this repo.

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
