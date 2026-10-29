# Handover (2026-10-29)

**2026-10-29: the general profiles are built and committed locally but NOT yet published. Read "General profiles" below, then follow "Publishing the profiles" before anything else.**

For the next agent (or person) working on the Linux laptop clone. Read this first, then `README.md`; `docs/superpowers/progress/HANDOFF.md`
is the long history of the timeline work and is **partly stale** (see "Stale docs" below). The workstation (Windows, holds the Blender
and Resolve masters) answered the clone's `request.md` with this file; `request.md` is deleted.

## Where things stand

- Live site: `https://toma-zacatecas.phantasmalabs.com` (Cloudflare Worker `toma-zacatecas`; the old `toma-zacatecas.phantomvfx.workers.dev` also works).
- `master` on GitHub (`Phantasma-labs/batallazac`, public) is the single source of truth. Tests: 658 pass, 1 skipped (after the profiles); `npm run typecheck` is clean.
- Live today = the PWA build of 2026-10-22. The profile buttons and panel (10 local commits ahead of `origin/master`) are not live until "Publishing the profiles" is done.
- Five films play on the timeline, all Spanish: `felipe-angeles` (00:00, resumes at 10:00), `villistas` (12:00), `natera` (16:00), `zacatecas-centro` (17:00), `la-bufa` (19:00). Narration for the map is Spanish.
- **No English film exists.** The English page plays the Spanish films with English subtitles (`public/videos/*.en.vtt`). The earlier
  note that `videos/villistas-en.mp4` is expected was out of date; nothing in `src/` references it, so a 404 for it is correct.

## What is in git and what is not

| In git (a fresh clone runs) | Not in git |
|---|---|
| App source, tests, scripts, `worker/`, `wrangler.jsonc` | `public/videos/*.mp4` (git-ignored; 18-21 MB each, the repo is public), including the three portrait clips `angeles-portrait.mp4`, `villa-portrait.mp4`, `natera-portrait.mp4` (0.3-0.6 MB each) |
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

## The PWA (built and deployed 2026-10-22)

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

Deployed 2026-10-22 (Worker versions 465b6ab1, then bda1c116 with the fix below). The first live check found a bug the preview did
not show: Cloudflare answers `/index.html` with a 307 to `/`, so the precached `index.html` was a redirected response, which a
navigation cannot use, and the app did not reload offline. The page is now cached under the scope root (`/`). `npx wrangler dev`
reproduces the redirect locally and is the test to run after touching `sw.ts` (the old code fails it, the fix passes it: offline `/`,
`/?lang=en` and `/?lang=es` all boot with no console errors). The other bug the browser check caught: module scripts are CORS requests,
and a server that answers `Vary: Origin` never matched the cached copies until the lookups used `ignoreVary` (kept in `sw.ts`).

Checked on the live site after the second deploy (Chromium, fresh profile): the worker installs and precaches 36 files; a film's first
range request comes from R2 (206) and the whole file is stored in `films-v1`; offline, `/`, `/?lang=en` and `/?lang=es` boot with no console
errors, the stored film answers 206/416/200 correctly and a `<video>` seeks to 20 s. Not checked: a visitor who had the first (broken)
worker: the cache name is a hash of the precached files, which did not change, so the new worker adds the page to the same `app-*` cache;
that path was reasoned, not run. Also not checked: Safari/iPadOS and real tablet hardware. Before announcing it, open the live site on an iPad once and repeat "play a film,
go offline, reload, seek".

## General profiles (built 2026-10-29)

Three buttons at the bottom centre (Ángeles, Villa, Natera; the Federales were dropped on purpose) pause the day and open a modal profile
panel: a silent portrait clip that plays once and rests on its last frame, name / role / years, the Army block under them, then Skills
(bullets), His part at Zacatecas and Known facts. Closing resumes the clock from the same minute (only if it was playing). Spanish and English
text; the panel closes itself after 90 s untouched and blocks the 10 s end-of-day reset while open. Spec
`docs/superpowers/specs/2026-10-29-general-profiles-design.md`, plan `docs/superpowers/plans/2026-10-29-general-profiles.md`.

- Code: `src/profiles/` (`profiles.ts` store, `GeneralButtons.tsx`, `ProfilePanel.tsx`, `generals.ts` = all the text, `portraits.ts`, `panelIdle.ts`), styles in `src/ui/profile.css`.
- The text is the researched, approved `Research/General_Profiles_Content.md` (workstation only, outside this repo: ES + EN, sources and confidence tags per line).
  Rules that were decided, so do not "improve" them: no Ammunition row (no source gives an honest figure); no row whose figure does not exist; no
  Villa quotation (unverified); no estimate note under the Army block; Ángeles's artillery reads "30 cañones" / "30 cannons" (the owner's figure,
  although sources give 13 to 40). `generals.test.ts` fails on a leftover `TODO`, a missing language or an ammunition row.
- The clips are **not** `VIDEO_SOURCES` films: `portraits.ts` has its own table, and the file names `videos/<id>-portrait.mp4` (+ `.jpg` poster and `<id>-thumb.jpg` round button picture) must not collide with a film.
  Ángeles = `Shots/001-FelipeAngeles/video/010_Prores.mov` (slow push-in on the colour portrait); Villa = the restoration comp of clip 002; Natera =
  a Seedance 2.5 render of the processed still `Shots/Portraits/stills/finalforvideo.png` (master `Shots/Portraits/masters/natera_final_720.mp4`). Masters
  are on the workstation only. Re-encode with `npm run optimize-video -- <master> <id>-portrait --max-height 720`, then cut the thumbnail from the last frame (240x240; use `-ss` near the end, `-sseof` returned the wrong frame).
- The three `.mp4` files are git-ignored like the films; the `.jpg` posters and thumbnails are in git. The service worker already treats `videos/*.mp4` as films (not precached, stored whole after the first play), and the new `.jpg` files change the precache hash, so visitors pick up the new build on their next reload. No `sw.ts` change was needed or made.
- Checked in the browser (Chromium, dev server): the three buttons, the Villa and Natera panels, layout at 1920x1080 and an 800x600 pane, `npm test` and `npm run typecheck`.
- **Published 2026-10-29**: Worker version `a75e080d-8875-42e4-a95a-f30e4016a873` (previous `fba52799-1fff-471c-b4e1-f3253ea336d5`, the `wrangler rollback` target), the three clips in R2, 10 commits pushed. Checked on the live site (Chromium via Playwright, 1920x1080): each clip answers `Range: bytes=0-1` with 206 and `HEAD` gives 568037 / 453180 / 344257; the six `.jpg` files answer 200; in ES and EN the three buttons sit at the bottom centre, each panel opens, its clip plays once and rests on its last frame, Army is under name/role/years, Skills are bullets, Ángeles reads "30 cañones" / "30 cannons", there is no estimate note, closing resumes the clock from the same minute, no console errors; offline after one play of the Natera clip, the app boots and the stored clip plays through again.
- Checked in Playwright's WebKit (Safari's engine, on Windows) with an iPad Pro 11 profile, landscape 1194x834, on the live site: the buttons (92x95, tappable) and thumbnails, the three panels opened by tap, each clip starts by itself (muted, inline), plays once and rests on its last frame, tapping the clip replays it, the 44 px X closes, each panel fits without scrolling (18 px text), the clock freezes while a panel is open and resumes on close, and `Range: bytes=0-1`, `0-` and a middle range answer 206 with a correct `Content-Range` for all three clips; no console errors, narration audio plays. **Not proven, still to do on a real iPad:** (1) offline storage: in that WebKit build media requests bypass the worker (nothing reaches `films-v1`, and the existing opening film behaves the same), so the clip played offline from WebKit's own cache and that proves nothing about the worker; run "play a portrait, Share > Add to Home Screen, airplane mode, launch, tap the same portrait"; (2) portrait orientation: the app's own "rotate your device" notice covers the screen, so the panels are landscape-only (existing behaviour); (3) touch feel, Low Power Mode (can block autoplay even of muted video) and the Home Screen app.

### Publishing the profiles

Order matters: R2 first (it only adds three keys), then push, then deploy. Deploying first would ship panels whose clips fall back to the
Worker's non-range static copy.

1. `git status` clean, `npm test && npm run typecheck`.
2. `npx wrangler whoami` (the account that owns the Worker `toma-zacatecas`; `npx wrangler login` if not).
3. Upload the three clips (from this machine, which has the files):
   ```bash
   for n in angeles villa natera; do
     npx wrangler r2 object put toma-zacatecas-films/videos/$n-portrait.mp4 --file public/videos/$n-portrait.mp4 --content-type video/mp4 --remote
   done
   ```
   Sizes in bytes to confirm against: angeles 568037, villa 453180, natera 344257.
4. `git push origin master` (10 commits).
5. `npm run deploy:dry`, then `npm run deploy`.
6. Check the live site (see the checklist in the publish prompt: three ranged requests answer 206, posters and thumbs 200, panels open, a clip rests on its last frame, a second visit works offline after one play).

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
