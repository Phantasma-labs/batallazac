# Request: what the second clone needs from the workstation

This file is for whoever (or whichever Claude) works on the **workstation** that holds the master copy of this project.
A second clone (a Linux laptop) was made from GitHub and is missing a few things that were never committed. We are going to turn the
app into an installable PWA (tablets and desktop; no phones) and the clone cannot ship it safely until the items below are in git.

Please do the steps, commit and push to `master`, then delete or tick off this file. Do **not** put secrets, API tokens or account
ids in the repo (it is public).

## 1. The Worker script that serves the films from R2  (blocking)

The deployed Worker `toma-zacatecas` (at `toma-zacatecas.phantasmalabs.com`) has two bindings: `ASSETS` (the built app) and
`FILMS` (an R2 bucket, `toma-zacatecas-films`). But `wrangler.jsonc` in the repo only has `assets.directory = ./dist`, and there is no
Worker script and no `FILMS` anywhere in the repo.

**Risk:** running `npm run deploy` from the clone would replace the live Worker and drop the `FILMS` binding, so the films would 404.

Please commit:
- [ ] The Worker entry file (the one with `fetch(request, env)` that reads `env.FILMS`), wherever it lives on the workstation.
- [ ] The real `wrangler.jsonc` (with `main`, the `r2_buckets` binding named `FILMS`, and `assets.binding = "ASSETS"` if it is set).
- [ ] A line in the README on how films are uploaded to the bucket (the exact `wrangler r2 object put` command or script used).

Things I'd like to know from the code: how the `/videos/*` path is routed (R2 first, assets as fallback?), whether it answers `Range`
requests with 206, and which `Cache-Control` it sets (`public/_headers` only applies to static assets, not to R2 responses).

## 2. English cut of the 12:00 film

`src/video/videos.ts` expects `videos/villistas-en.mp4`. The live site returns **404** for it (the other five films return 206 and seek
fine). Is it meant to be in R2?
- [ ] If yes: upload `villistas-en.mp4` to the bucket under the same key the Worker expects.
- [ ] If not ready yet: say so, and the English page keeps falling back to the Spanish cut.

## 3. Optional, only if they exist and are small

- [ ] The video optimiser output settings used for the six films (the `scripts/optimize-video.mjs` defaults are probably right; confirm).
- [ ] Any other file the live site needs that is not in the repo (`git status` on the workstation shows untracked files? list them).

## What the clone will do next (so you can object)

1. Install `ffmpeg` and ImageMagick (icons from `public/favicon.svg`).
2. Add `public/manifest.webmanifest`, 192/512/maskable PNG icons, `apple-touch-icon`, a service worker (precache app, models, audio;
   cache each film after first play; pass `Range` through) and an Install button.
3. Keep films at `/videos/*` on the same origin so no CORS or `videos.ts` change is needed.
4. Check with Lighthouse and a Playwright tablet emulation. Nothing is deployed until the items in section 1 are in git.
