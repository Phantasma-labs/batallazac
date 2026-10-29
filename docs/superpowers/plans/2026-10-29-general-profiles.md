# General profiles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three bottom-centre buttons (Ángeles, Villa, Natera) that pause the day and open a layout-A profile panel with a silent portrait clip that plays once and holds its last frame; closing resumes the day exactly where it stopped.

**Architecture:** A new pure store `createProfiles(clock, playback)` (same shape as `createPlayback`, read by React through `useSyncExternalStore`) owns open/close/resume. Typed data lives in `src/profiles/generals.ts`; two small React components (`GeneralButtons`, `ProfilePanel`) and `src/ui/profile.css` render it. The idle reset learns to treat an open panel as "someone is here", and a separate 90 s watcher closes an abandoned panel. No change to `playback.ts`, the Director, the camera, the scene or the service worker.

**Tech Stack:** React 19, TypeScript, vitest (pure-TS tests, fake timers), plain CSS with the `--px`, `--paper`, `--gold`, `--red`, `--ink` tokens.

**Spec:** `docs/superpowers/specs/2026-10-29-general-profiles-design.md` (read `HANDOVER.md` and the README's "Install and offline (PWA)" section first).

## Global Constraints

- Three buttons only; **no Federales panel**.
- No new audio, narration, music, SFX or subtitles on the portrait clips. No change to `playback.ts`, the five hotspot films, the timeline events, the camera or the 3D scene.
- **No invented history:** every number and every sentence about a general is the literal string `'TODO'` (both languages) until supplied; only `id` and `name` are filled. No quotations, no archive text.
- `open(id)` is ignored while a film is open or a panel is already open. `close()` calls `clock.play()` only if the clock was playing at `open`, and **never `seek`s**.
- While a panel is open: Space, arrows and the other app keys do nothing to the clock or camera; Esc closes; focus returns to the opening button.
- The 10 s end-of-day reset must not fire while a panel is open; a panel with no input for **90 s** closes itself.
- Video: `<video muted playsInline>`, **no `loop`**, keyed by the opening token, `poster` = first frame, tap replays; do not close on `ended`, no `held` watchdog. Portrait files go in a **new** `PORTRAIT_FILES` table, not `VIDEO_SOURCES`.
- Files `public/videos/{angeles,villa,natera}-portrait.mp4` (git-ignored, served from R2), `*-portrait.jpg` (first frame, poster), `*-thumb.jpg` (last frame, button), made with `npm run optimize-video` at 720p.
- Buttons: real `<button>`, ≥ 48 px, red side colour (`var(--red)`), round last-frame thumbnail above the name; hidden while a film is open and while the Loader shows.
- Panel: `role="dialog" aria-modal="true"`, 16:9 video box top-left, name/rank/years top-right, then Army / Skills / His part at Zacatecas / Known facts; one note line "Estimación histórica; las fuentes difieren" / "Historical estimate; sources differ". Body text ≥ 20 px at 1920 px wide via `clamp`; the text block scrolls inside the panel at 1024×768, the video and the X never scroll away.
- Spanish primary, English through `t(es, en)` / `pick`. Desktop and tablet landscape only. Public repo: no secrets. `npm test` and `npm run typecheck` pass before every commit. **Do not run `npm run deploy`.**
- Match `playback.ts` / `VideoOverlay.tsx` in comment density and idiom; commit messages `type: subject`.

## Review Focus

1. **Open at the very end of the day** (clock at 20:00, stopped): close must leave it stopped at 20:00; `clock.play()` there would restart the day. (Task 2 test.)
2. **Open → close → open the same general straight away:** the second opening starts the clip from its first frame (new token), and a panel never opens on top of another. (Task 2 tests.)
3. **Esc, Space, arrows, W/A/S/D with the panel open** must not reach the camera (`LockedCamera` turns the director off on Esc) or the clock. (Task 4: capture-phase key guard, verified in the browser.)
4. **A panel left open at the end of the day** with input every few seconds stays open; one with none for 90 s closes and, if the day was playing, resumes and finishes, then the normal 10 s reset applies. (Task 3 tests.)
5. **A general without a clip or thumbnail** (Villa and Natera until their files exist): button and panel still work with no broken image. (Task 4: `portraitOf` returns `undefined`; components render the fallback.)

---

### Task 1: The data file

**Files:**
- Create: `src/profiles/generals.ts`
- Test: `src/profiles/generals.test.ts`

**Interfaces:**
- Consumes: `Bilingual` from `src/timeline/model.ts` (`{ es: string; en: string }`).
- Produces: `type GeneralId = 'angeles' | 'villa' | 'natera'`; `type Stat = { label: Bilingual; value: Bilingual }`; `type General = { id: GeneralId; name: string; role: Bilingual; years: string; army: Stat[]; skills: Bilingual[]; part: Bilingual; facts: Bilingual[] }`; `const GENERALS: readonly General[]` in the order Ángeles, Villa, Natera; `const generalOf: (id: GeneralId) => General`.

- [ ] **Step 1: Write the failing test** `generals.test.ts`: `GENERALS.map(g => g.id)` equals `['angeles','villa','natera']`; names are `'Felipe Ángeles'`, `'Pancho Villa'`, `'Pánfilo Natera'`; each general has ≥ 1 army row, 3–4 skills, 2–3 facts; `generalOf('villa').name` is `'Pancho Villa'`; every `army` label is non-empty in both languages; **no value, role, years, skill, part or fact is anything but `'TODO'`** (guards "no invented history" until real text is supplied — Step 3's test note says to delete this assertion when real data lands).
- [ ] **Step 2: Run** `npx vitest run src/profiles/generals.test.ts` → FAIL (module missing).
- [ ] **Step 3: Implement** the file. Army row *labels* (structure, not claims) are: Ángeles `Hombres/Men`, `Artillería/Artillery`, `Municiones/Ammunition`; Villa `Hombres/Men`, `Caballería/Cavalry`, `Municiones/Ammunition`; Natera `Hombres/Men`, `Caballería/Cavalry`, `Municiones/Ammunition`. Every `value`, `role`, `years` (`'TODO'`), skill (3 × `{es:'TODO',en:'TODO'}`), `part`, and fact (2 ×) is `TODO`. A header comment says sources are kept here, numbers are ranges, and the TODOs are to be supplied (`Research/La Batalla de Zacatecas (1914).md`).
- [ ] **Step 4: Run** the test → PASS.
- [ ] **Step 5: Commit** `feat: general profiles data file (placeholders)` (include the spec and this plan in this first commit).

### Task 2: The store

**Files:**
- Create: `src/profiles/profiles.ts`, `src/profiles/portraits.ts`
- Test: `src/profiles/profiles.test.ts`, `src/profiles/portraits.test.ts`

**Interfaces:**
- Consumes: `Clock` (`clock.playing`, `pause()`, `play()`, `time`), `GeneralId`.
- Produces in `profiles.ts`: `type OpenProfile = { id: GeneralId; resume: boolean; token: number }`; `createProfiles(clock: Clock, playback: { readonly current: unknown })` returning `{ current: OpenProfile | null; snapshot(): OpenProfile | null; subscribe(l): () => void; open(id: GeneralId): void; close(): void }`; `const profiles` (over the app's clock and playback); `usePanel(): OpenProfile | null` (`useSyncExternalStore`).
- Produces in `portraits.ts`: `type PortraitFile = { src?: string; poster?: string; thumb?: string }`; `const PORTRAIT_FILES: Partial<Record<GeneralId, PortraitFile>>`; `portraitOf(id: GeneralId): PortraitFile | undefined`.

- [ ] **Step 1: Write failing tests** in `profiles.test.ts` (rig like `playback.test.ts`: `createClock(start)`, a fake playback `{ current: null as unknown }`):
  - playing clock at 12:00 → `open('villa')` → `clock.playing === false`, `clock.time === hm(12)`, `current` = `{ id:'villa', resume:true, token:1 }`; `close()` → `current === null`, `clock.playing === true`, `clock.time === hm(12)` (no seek: also `clock.seeks` only rose by the one `play()`).
  - paused clock → open, close → still paused, time unchanged.
  - `playback.current = {}` → `open('angeles')` is ignored (`current` null, clock untouched); a second `open('villa')` while a panel is open is ignored (id stays `'angeles'`, token unchanged).
  - clock at `DAY_END`, paused → open, close → `time === DAY_END`, `playing === false`.
  - open/close/open same id → token goes 1 → 2; `close()` with nothing open does nothing; subscribers are called on open and close only.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `createProfiles` following `createPlayback` (module-level `current`, `tokens`, `listeners`); `close()` clears `current`, emits, then `if (open.resume) clock.play()`. Add `profiles` and `usePanel`.
- [ ] **Step 4: Write failing test** `portraits.test.ts`: `portraitOf('villa')` and `portraitOf('natera')` are `undefined` until their files exist; every defined entry's `src`/`poster`/`thumb` start with `videos/` and none of the ids collide with keys of `VIDEO_SOURCES`.
- [ ] **Step 5: Implement** `portraits.ts` (empty table for now; Task 5 fills Ángeles) and run both test files → PASS.
- [ ] **Step 6: Commit** `feat: profiles store (open pauses the day, close resumes it)`.

### Task 3: Idle behaviour

**Files:**
- Modify: `src/timeline/idleReset.ts` (export `ACTIVITY`; add `combine`)
- Create: `src/profiles/panelIdle.ts`
- Test: `src/timeline/idleReset.test.ts` (add cases), `src/profiles/panelIdle.test.ts`

**Interfaces:**
- Consumes: `Playback` shape `{ readonly current: unknown; subscribe(l): () => void }`; `profiles.close()`.
- Produces: `combine(...sources: Playback[]): Playback` (its `current` is the first non-null `current`, `subscribe` subscribes to all and returns one unsubscribe); `PANEL_IDLE_MS = 90_000`; `watchPanelIdle(profiles: { readonly current: unknown; subscribe(l): () => void; close(): void }, source?: Source, ms = PANEL_IDLE_MS): () => void`.

- [ ] **Step 1: Failing tests** in `idleReset.test.ts`: `watchIdleReset(clock, combine(playback, panelLike), source)` with the clock at `DAY_END` does **not** reset after `IDLE_RESET_MS` while `panelLike.current` is set, and resets 10 s after it is cleared and its listeners are notified; `combine(a, b).current` is `b.current` when only `b` is open.
- [ ] **Step 2: Failing tests** in `panelIdle.test.ts` (fake timers, `EventTarget` source): nothing happens with no panel open; with a panel open, `close` is called at 90 000 ms; a `pointermove` at 89 000 ms pushes it to 179 000 ms; opening later arms the timer; closing disarms it; the returned stop function removes the listeners.
- [ ] **Step 3: Run** → FAIL. **Step 4: Implement** both (reuse `ACTIVITY`; `watchPanelIdle` mirrors `watchIdleReset`'s arm/subscribe/teardown structure).
- [ ] **Step 5: Run** the three test files → PASS. **Step 6: Commit** `feat: an open profile blocks the end-of-day reset; an abandoned one closes after 90 s`.

### Task 4: Buttons, panel and wiring

**Files:**
- Create: `src/profiles/GeneralButtons.tsx`, `src/profiles/ProfilePanel.tsx`, `src/ui/profile.css`
- Modify: `src/App.tsx` (mount both after `<VideoOverlay />`), `src/ui/TimelineBar.tsx:52,56` (use `combine(playback, profiles)` for `watchIdleReset`; the key guard returns when `playback.current || profiles.current`; start `watchPanelIdle(profiles)` in an effect)

**Interfaces:**
- Consumes: `usePanel`, `profiles`, `GENERALS`, `portraitOf`, `usePlayback`, `useProgress` (drei, as `Loader`), `pick`, `t`.
- Produces: `GeneralButtons()` and `ProfilePanel()` components; no new exports used elsewhere.

- [ ] **Step 1: `GeneralButtons`**: a `<nav className="pf-buttons" aria-label={t('Los tres generales','The three generals')}>` with one `<button>` per general (round `<img>` from `portraitOf(id)?.thumb`, or a red circle with the initial when there is none, above `name`); `onClick` → `profiles.open(id)` and remembers the button element; returns `null` when `usePlayback()` is non-null or `useProgress().progress < 100`.
- [ ] **Step 2: `ProfilePanel`**: returns `null` unless `usePanel()`; keyed child per token. Layout A exactly as in Global Constraints; the `<video>` has `muted playsInline preload="auto"`, no `loop`, `poster`, `onClick` replays (`currentTime = 0; play()`); a missing `src` shows the poster only, a missing poster a dark box. Window `keydown` listener registered in the **capture** phase: `Escape` → `preventDefault`, `profiles.close()`; every key except `Tab` gets `stopPropagation()` so the clock, camera director and WASD pan never see it; `Tab` cycles between the close button and the scroll block (`tabIndex={0}`). On unmount, focus returns to the button that opened it (stored in a module variable set by `GeneralButtons`).
- [ ] **Step 3: `profile.css`**: `.pf-buttons` fixed, `left: 50%`, `bottom: calc(16 * var(--px))`, `transform: translateX(-50%)`, `z-index: 28` (under the subtitle plate at 29 and the timeline at 30), `--px` defined as in `subtitle.css`; buttons ≥ 48 px, `var(--red)` border/label; `.pf` fixed `inset: 0`, `z-index: 40`, dimmed backdrop; the panel max `min(92vw, 1500px)`, `max-height: 92vh`, grid with the 16:9 video top-left and name/rank/years top-right, text block `overflow-y: auto`; body text `font-size: clamp(17px, 1.05vw, 24px)` (≈ 20 px at 1920); `@media (prefers-reduced-motion)` kills transitions; focus rings as in `video.css`.
- [ ] **Step 4: Wire** `App.tsx` and `TimelineBar.tsx` as listed.
- [ ] **Step 5: Run** `npm run typecheck && npm test` → PASS.
- [ ] **Step 6: Commit** `feat: three general buttons and the profile panel`.

### Task 5: The portrait media

**Files:**
- Modify: `src/profiles/portraits.ts`
- Create (git-ignored `.mp4`; `.jpg` committed): `public/videos/angeles-portrait.mp4`, `angeles-portrait.jpg`, `angeles-thumb.jpg`

**Interfaces:**
- Consumes: `npm run optimize-video -- <master.mov> <name> [--max-height 720]`.
- Produces: the `angeles` entry of `PORTRAIT_FILES`.

- [ ] **Step 1:** Make the Ángeles clip from the one portrait master on disk (`IO/From_AI/AIDocs_TomaZacatecas/001-FelipeAngeles/magnific_a-living-portrait-of-a-ma_Do5i6EUpcl.mov`) with `--max-height 720`, name `angeles-portrait`; `ffmpeg` the last frame to `angeles-thumb.jpg` (square-croppable, ≤ 40 KB). **Flag in the report:** this is the only portrait clip on disk and must be confirmed as the intended Ángeles clip; Villa and Natera have only still sources and stay unlisted.
- [ ] **Step 2:** Add the `angeles` entry (`src`, `poster`, `thumb`); `npx vitest run src/profiles/portraits.test.ts` → PASS.
- [ ] **Step 3: Commit** (jpgs + `portraits.ts`; the mp4 stays git-ignored) `feat: Ángeles portrait clip`. **Do not upload to R2 and do not deploy**; list both as steps for the user in the report.

### Task 6: Verify in the browser and document

**Files:**
- Modify: `README.md` ("How it works" table: one row for `src/profiles/`)

- [ ] **Step 1:** `npm run dev`, then in the browser at 1920×1080 and 1180×820, the spec's Definition of Done: (1) Play, wait for a narration line, open a general mid-line: voice and music stop, clock freezes; close: the same line carries on, the clock moves; (2) open while paused, close: still paused; (3) the Ángeles clip plays once and holds its last frame, tap replays; (4) seek to 20:00, open a panel, wait > 10 s with no reset; (5) no overlaps with play/sound/install/EN (bottom-left), the caption plate (bottom-right), `Subtitle`; text legible; also Esc closes without moving the camera, Space/arrows do nothing, buttons hide during a film and the Loader, Villa/Natera panels render with no broken image.
- [ ] **Step 2:** `npm run build && npm run preview`; load once, open the Ángeles panel (the clip is stored in `films-v1`), go offline, reload, open it again: the clip plays from the cache (the service worker's film rule already matches `videos/*.mp4`; the new `.jpg`s are precached). Fix anything that fails.
- [ ] **Step 3:** `npm test && npm run typecheck` → PASS; add the README row; commit `docs: profiles in the README`; push is left to the user's go (nothing is deployed).
- [ ] **Step 4:** Final report lists every remaining `TODO` (`grep -c "TODO" src/profiles/generals.ts`) and the open items (R2 upload of `angeles-portrait.mp4`, Villa/Natera clips, deploy).
