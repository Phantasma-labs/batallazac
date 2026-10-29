# General profiles: three buttons, three panels (design, 2026-10-29)

Read `HANDOVER.md` first (deploy rules: the films are served from R2), then the PWA section of `README.md`, then this file.

## Intent

The app is a day you watch. This adds a layer you can *learn from*: three buttons at the bottom-centre of the map, one per general
(**Felipe Ángeles, Pancho Villa, Pánfilo Natera**). A tap pauses the day and opens a panel about that general: his restored-photo
portrait coming alive, his army, his skills, his part in Zacatecas, a few well-known facts. Closing the panel puts the day back exactly
as it was. The audience is museum visitors on a desktop or tablet screen (no phones), walking up, reading for a minute, walking off.

## Goals

- Three buttons, always visible over the map, usable by touch.
- One panel per general, layout "A" (below), Spanish and English text through the existing `t(es, en)` / `pick` helpers.
- Opening pauses everything (clock, narration, music); closing resumes **exactly where it stopped**.
- The panel video plays **once, silent, and stays on its last frame** (the restored colour portrait).
- Numbers are honest: ranges with a small "historical estimate" note, never invented precision.

## Non-goals and anti-goals

- **No Federales panel.** Four buttons were considered; three is final.
- No new audio, narration, music or SFX. No subtitles on the portrait clips.
- No change to the five hotspot films, `playback.ts` behaviour, the timeline events, the camera or the 3D scene.
- No quotations in the panel text unless verified: there is no verified Villa speech quote. No invented archive text, no invented numbers.
  Anything not in `generals.ts` as supplied is a gap to flag, not to fill.
- Anti-goal: a panel that leaves the day broken (clock restarted, narration cut, music stuck, the idle reset firing under a reader).

## The parts, as decided

**Buttons.** Bottom-centre, a row of three: a small round portrait (the *last* frame of the clip, the restored colour face) above or beside
the name. All three use the red side colour (`#c0392b`-ish; use the app's existing red token if there is one): they are the three generals of
the winning side. Touch target at least 48 px; real `<button>` elements. Hidden while a film is open (the film covers the screen anyway) and
while the Loader shows. Check against the other bottom controls (play/sound/install/EN at the bottom-left, the caption plate at the
bottom-right, `Subtitle` at z-index 29) in the browser at 1920x1080 and at a tablet landscape size; nothing may overlap.

**Panel, layout A** (the user's own sketch; modal over the map with a dimmed backdrop, close X top-right, `role="dialog" aria-modal`):
- Top-left: the portrait video (16:9 box, because the existing clips are 1920x1080).
- Top-right of the video: three short lines: name, rank/role, years.
- Below: a text block with labelled rows:
  1. **Ejército / Army**: a list of stat rows (see data model). Rows differ per general: a general without artillery but with cavalry
     shows cavalry instead. (The "Historical estimate; sources differ" note line was dropped on 2026-10-29 at the user's request.)
  2. **Habilidades / Skills**: 3 or 4 short tags or one line each.
  3. **Su papel en Zacatecas / His part at Zacatecas**: 2 or 3 sentences tied to what the map shows.
  4. **Datos / Known facts**: 2 or 3 bullets.
- Museum legibility: body text at least 20 px at 1920 px width, scaling with the viewport (`clamp`), high contrast on the app's dark paper
  look (see `video.css` and `--paper`). No hover-only behaviour. If the text does not fit a 1024x768 tablet, the text block scrolls inside
  the panel; the video and the X never scroll away.

**Opening and closing** (a new small store, same shape as `createPlayback` in `src/video/playback.ts`: pure, takes the clock and the
playback, unit-tested with vitest; React reads it through `useSyncExternalStore`):
- `open(id)`: ignored if a film is open or a panel is already open. Else remember `resume = clock.playing`, `clock.pause()`, show the panel.
- `close()`: hide, then `if (resume) clock.play()`. If the day was already paused, it stays paused. **Do not `seek` anything.**
- Pausing the clock already pauses the narration (it pauses and resumes mid-line) and ducks the music (`musicTarget`); verify this in the
  browser rather than adding code. If something keeps playing, fix it there.
- While a panel is open: Space and the arrow keys do nothing to the clock (find the key handlers in `TimelineBar.tsx` and `playback`'s
  `toggle`), Esc closes, the backdrop blocks the timeline and the map. On close, focus returns to the button that opened it.

**Idle behaviour** (`src/timeline/idleReset.ts`): `finished()` must also be false while a panel is open, so the 10 s reset never fires under a
reader. *Builder's call, flagged:* a panel left open with no input for 90 s closes itself (so an abandoned kiosk recovers; if the day was
playing before, it resumes and finishes by itself, then resets as today).

**The video.** One silent MP4 per general, played by a plain `<video muted playsInline>` in the panel: starts from the first frame each time
the panel opens (key the element by an opening token as `VideoOverlay` does), **no `loop`**, so it rests on its last frame when it ends
(do not `close()` on `ended`; do not add the `held` watchdog of `VideoOverlay`). Tapping the video replays it. `poster` = the first frame
(the aged photo for Villa and Natera; Ángeles's clip is a colour push-in, so his first frame is already colour) so the box is never empty. If a general's file is not listed yet, show the poster image only: the panel still works.
Files: `public/videos/angeles-portrait.mp4`, `villa-portrait.mp4`, `natera-portrait.mp4`, plus `*-portrait.jpg` (first frame, the poster) and
`*-thumb.jpg` (last frame, for the button), made with `npm run optimize-video` (720p is plenty for this box). Register them in a **new**
`PORTRAIT_FILES` table next to the new store, **not** in `VIDEO_SOURCES` (that table is for timeline hotspots and the ids must not collide
with the `felipe-angeles` film). The MP4s are git-ignored and served from R2 like the other films: follow the Deploy section of
`HANDOVER.md`, and check the service worker rules in the PWA section of `README.md` (offline behaviour of the new files) in a real browser.

**Data.** One file, `src/profiles/generals.ts`, typed, no logic:

```ts
type Stat = { label: Bilingual; value: Bilingual }   // value is already a range string, e.g. "~20,000–23,000"
type General = {
  id: 'angeles' | 'villa' | 'natera'
  name: string; role: Bilingual; years: string
  army: Stat[]                 // differs per general: men, artillery or cavalry, ammunition...
  skills: Bilingual[]
  part: Bilingual              // his part at Zacatecas
  facts: Bilingual[]
}
```

**The content is written and approved**: `../../../../Research/General_Profiles_Content.md` (repo root `Research/`; ES + EN, per general: header,
army rows, skills, part at Zacatecas, facts). Transcribe it into `generals.ts` verbatim; do not add, rephrase or "improve" historical claims.
Rules for transcribing:
- Drop the `[tags]` and source notes; they are for us, not the panel.
- **No Ammunition row** (decided: no honest number exists). Ángeles's rows are artillery (`30 cañones`, the user's figure, 2026-10-29) and command;
  Villa's are men, main arm, support; Natera's are command and men. Rows differ per general by design.
- Where a row is tagged `[?]` (Ángeles's men, Natera's cavalry, Dorados headcount) it is **not shown**.
- Natera, thin sources: show "~6,000 (junto con los hermanos Arrieta)"; show birth as "1882" only (no birthplace); keep the 12–14 June wording.
- Villa's "Espero que esta pelea la ganen sus cañones" is **not** used (unverified quote).
- No note line under the army block (removed 2026-10-29).
If anything in the file contradicts what you can see on the map (dates, places), stop and report it rather than choosing.

## Constraints

- Public repo: no secrets, tokens or account ids. `npm test` and `npm run typecheck` must pass before any commit.
- Match the surrounding code: comment density and idiom of `playback.ts` / `VideoOverlay.tsx`, CSS in a new `src/ui/profile.css` using the
  same tokens as `video.css`.
- Spanish is the primary text; English through `t(es, en)`. The ES/EN button already exists.
- Desktop and tablet landscape only; the existing `OrientationNotice` covers portrait.

## Left to the builder

File and component names inside `src/profiles/`, exact button styling within the rules above, the exact panel size, the focus-trap
mechanics, the test list (at minimum: open/close/resume maths, "stays paused if it was paused", ignored while a film is open, idle reset
blocked while open).

## Definition of done

Verified in the browser, not only by tests: (1) press Play, wait for a narration line, tap a general mid-line: voice and music stop, the clock
freezes; close: the same line carries on and the clock moves; (2) tap with the day paused: close leaves it paused; (3) the clip plays once and
holds the last frame; (4) at the end of the day a panel open for more than 10 s is not reset; (5) 1920x1080 and a 1180x820 tablet, no overlaps,
text readable; (6) `npm test` and `npm run typecheck` pass; (7) a short list of anything in the content file you could not place or that looked wrong. The Natera clip may still be missing when you build: the poster-only fallback must work, and its absence is not a failure.

## Calls I made (flag, the user can overturn)

Round last-frame thumbnails on the buttons; first-frame poster; tap-to-replay; 16:9 video box; 90 s idle auto-close; panel text in both
languages; "resume only if it was playing" as the reading of "resume exactly where it stopped"; sources kept in the data file's comments,
not shown on the panel.
