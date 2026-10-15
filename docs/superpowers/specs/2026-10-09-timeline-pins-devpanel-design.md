# Timeline, Pins and Marching Flags — Design (dev panel deferred)

Extends [2026-10-01-scene-foundation-design.md](2026-10-01-scene-foundation-design.md) and the tripod camera
(`src/camera/locked.ts`). Status: **built as a foundation (2026-10-09)**; see `../progress/HANDOFF.md` for what is done and what is left.

## Goal

A viewer plays or scrubs a clock for **23 June 1914** and watches the battle happen on the board: the camera
follows the events, glowing flags march between the hills, and pins name the places. The **dev panel** for
fine-tuning shots by hand is a separate, later task (see "Deferred"); this spec only leaves room for it.

Success looks like:
1. Named pins on the board: Cerro del Grillo, Vetagrande, Cerro de la Sierpe, Cerro de la Bufa, plus Centro de Zacatecas and Cerro de Loreto.
2. A bottom timeline (play / pause / speed / scrub) whose events move the camera and update a caption.
3. Ángeles' glowing flag fires on La Bufa from Vetagrande, walks to Cerro de Loreto, then fires on La Bufa and
   El Grillo; Villa's flag advances on El Grillo and then on the city centre. Glowing attack arrows show who
   hits what, and everything replays backwards when you scrub back.
4. Camera shots are data (per-shot position, target, lens, roll), so the later dev panel can edit and bake them.

## What the user said (decisions already made)

- Pins: small 3D marker + label. Cerro del Grillo, Vetagrande and La Bufa are the existing clickable hotspots.
  **La Sierpe is a pin only: no hotspot, not clickable.**
- Timeline slider focuses the camera on events as they happen. Play, pause and scrub are all user controlled.
- Glowing animated flags travel between pins (Ángeles: Vetagrande → Cerro de Loreto). Cannons and soldiers
  walking is **later**, but the data model must allow it.
- Tracks: Ángeles and Villa (two lanes; shared battle facts such as hills falling go in the Villa lane, the
  División del Norte's own).
- **Villa** starts fighting at **10:05**, advancing from the railway station in the south-west (the `villa-train` point), attacking Cerro del Grillo, then
  Zacatecas city centre. What matters is when he starts fighting, not when he arrived the day before.
- **Ángeles** attacks La Bufa from Vetagrande, then his guns advance to **Cerro de Loreto** (the hill halfway
  between Vetagrande and the city, north-north-east of the cathedral) and attack La Bufa and Cerro del Grillo
  from there. That is all of his track. (Corrected by the user on 2026-10-09: an earlier draft sent him to
  La Sierpe and dropped Loreto.)
- Cerro de Loreto is a pin for show, like La Sierpe: not clickable. La Sierpe stays a pin, and its fall at
  noon stays in the Villa lane.
- El Grillo falls at **~13:00**.
- Camera **translation is per shot**: a shot may set its own camera position; if it doesn't, it inherits
  the tripod position.

## Out of scope

The dev panel (deferred, below); animated cannons and soldiers; narration/audio; the video overlay; a UI language toggle (data carries ES and
EN, the UI shows EN); phone or portrait layouts (see Display target).

## Zoom is off for now (user decision, 2026-10-09)

The timeline does not zoom to hotspots: the fully animated 3D map is enough, so the camera stays on the wide shot
from 09:30 to 18:30, and clicking a hotspot does nothing. Everything else in the shots design stays in the code
(per-shot positions, event shots, the director, `BAKED`), switched off in one place: `zoomFromSearch` in
`src/camera/mode.ts`, read by `LockedCamera`. `?zoom=on` brings it all back. The captions and the clock still follow
the events; only the camera is still. Consequence for design work: judge every piece in the wide shot.

## Display target

Landscape only, minimum **1344 x 768**. The timeline bar, captions, pin labels are laid out for
that size and up (the bar is a fixed-height strip at the bottom;). No responsive or touch layouts. In a portrait window, or one narrower than 1280 or shorter than 600 px (a browser's own bars take some of a
1344 x 768 screen, so the notice allows for them), a simple full-screen notice asks for a landscape window
of at least 1344 x 768; the scene keeps rendering behind it. Visual checks use 1344 x 768 as the smallest case, plus 1920 x 1080.

## Architecture

New code lives in `src/timeline/` and `src/dev/`; camera changes stay in `src/camera/`.

### 1. Shots (camera) — `src/camera/shots.ts`

Today a hotspot produces one auto-fitted shot from the fixed tripod. Generalise to a **shot**:

```ts
type ShotPose = { position: Vec3; target: Vec3; fov: number; rollDeg: number }
type Shot = { id: string; auto?: Hotspot }          // auto = today's hotspot/wide solver
const BAKED: Record<string, Partial<ShotPose>> = {} // baked shot values (filled by hand now, by the dev panel later)
```

Resolution: start from the auto pose (hotspot fit, or the wide shot), then apply any `BAKED` fields.
A fully baked shot is used **exactly as given** (no `keepOnBoard` correction; the author framed it).
`LockedCamera` interpolates between any two poses: position (smoothstep lerp), orientation (slerp), lens
(log-lerp, as now). Focus distance for the macro DoF is the position→target distance. The tripod position
remains the default, so unbaked shots behave exactly as today. Shots: `wide`, the five existing hotspots,
and new event-only shots (e.g. `march-vetagrande-loreto`, which frames the whole path).

Baked values are **world coordinates after the floor stretch**. If the board is re-exported with a different
stretch they must be re-tuned.

### 2. Pins — `src/scene/Pins.tsx`, `src/scene/pins.ts`

`pins.ts`: `{ id, label, point, clickable, hotspotId? }`. Points are authored on the original board and run
through `stretchHotspots`, like hotspots. `y` comes from a ground sampler (one raycast pass over the floor
mesh at load) so markers and paths sit on the terrain.

- Vetagrande → hotspot `angeles-artillery`; Cerro del Grillo → `elgrillo`; La Bufa → `labufa` (all clickable).
  A fifth pin, **Centro de Zacatecas**, uses the `cathedral` hotspot and is Villa's last objective.
- La Sierpe: ~300 m NW of El Grillo (Research: México Desconocido), `clickable: false`. Initial guess
  roughly `elgrillo + (-90, 0, -90)` on the original board; tuned later.
- Marker: a small emissive 3D pin; label via drei `<Html>` with constant on-screen size. Marker world size
  follows the lens so it reads in the wide shot but never covers a statue in a close-up.

### 3. Timeline data — `src/timeline/events.ts`

```ts
type Track = 'angeles' | 'villa'
type TimelineEvent = {
  id: string; track: Track
  time: number                       // minutes after midnight, 23 June
  title: { es: string; en: string }; text: { es: string; en: string }
  shot?: string                      // camera goes here when this becomes the latest shot event
  march?: { unit: string; path: PathStop[]; endTime: number }  // unit moves from `time` to `endTime`
  attack?: { unit: string; target: string; endTime: number }   // glowing arrow unit -> target pin, `time` to `endTime`
  source: 'sourced' | 'inferred'; note?: string
}
```

`source: 'inferred'` events show a small marker in the UI so nothing invented reads as fact. A unit is
anything with a position over time (`angeles-flag` and `villa-flag` now, cannon/soldier groups later):
`unitPosition(unit, t)` is piecewise over its marches (before the first march: the first origin; between
marches: the last destination; during one: a point along its path at constant speed). Path stops are pin ids
or raw points (a start point such as Villa's start is the `villa-train` hotspot point).

The initial event list is in the appendix.

### 4. Clock and director — `src/timeline/clock.ts`, `src/timeline/director.ts`

- `clock`: plain store `{ time, playing, speed }` with `subscribe` and a `useSyncExternalStore` hook.
  The frame loop reads `clock.time` directly (no React re-render per frame); UI updates are throttled.
  Range 09:30–18:30 (constants). Default speed 4 sim-min per real second; speeds ¼×–4×.
- `director`: pure `activeShotEvent(events, t)` = the latest event with a `shot` and `time <= t` (ties:
  authoring order). When it changes, `LockedCamera.focusOn(shotId)` runs, with the existing 1.4 s tween,
  whether the change came from playing or scrubbing.
- Manual hotspot click: pauses playback and focuses that hotspot. Esc: wide shot and director off until
  the next play or scrub.

### 5. Timeline UI — `src/timeline/TimelineBar.tsx`

HTML overlay at the bottom: play/pause, speed, clock readout, range slider (1 min step) with event ticks in
two lanes (Ángeles, Villa), and a caption card for the latest event per lane. Keys: Space
toggles play, ←/→ jump to the previous/next event.

### 6. Marching flags — `src/scene/MarchFlag.tsx`

One flag per unit: a pole and a cloth plane with a vertex wave, an emissive material and an additive halo
sprite (no new bloom pass; the existing glows already work this way). A dashed animated trail is draped on
the terrain along the path, revealed up to the unit's progress. The walk has a slight step bob. Reads
`unitPosition` every frame, so scrubbing backwards walks it back.

**Attack arrows.** While an `attack` event is active, a glowing animated arrow (the reference map's
style: orange for the attack, pulsing along its length) runs from the attacking unit's current position to
the target pin, draped over the terrain. It fades in and out at the ends of its time window.

## Deferred: dev panel (separate task)

A `?dev` panel for editing shots live (position, rotation, lens, roll; pick target; pin nudge; Copy JSON to
paste back for baking) comes later. This spec prepares for it: shots are plain data with baked overrides
(`BAKED` in `shots.ts`), poses are resolved in one place, and `LockedCamera` can be driven by an arbitrary
pose. Until then the author edits `shots.ts` and `pins.ts` by hand (or asks Claude to).

## Build order

1. Shot abstraction with baked overrides and per-shot position (no visible change).
2. Pins, including the Sierpe and Loreto flag-only pins and the ground sampler.
3. Clock, event data, director, timeline bar.
4. Marching flags.

## Testing

Pure logic gets vitest tests alongside the existing ones: pose resolution and baked overrides; clock
advance, speed and range clamp; `activeShotEvent`, including scrubbing back; `unitPosition` before,
during and after a march; event-data integrity (sorted by time, every `pin` and `shot` exists,
`source` present, times inside the range). Visual checks are done in the
browser pane through the existing `__map` dev hook, extended with `clock`.

## Decisions taken in review (2026-10-09)

1. El Grillo falls at ~13:00 (México Desconocido: Olea and the British consul), not the dossier's ~16:00.
   The dossier's "heights captured ~14:30" is dropped because Grillo is one of those heights. La Bufa stays at
   ~18:00 per the dossier; the article implies it fell soon after Grillo, so this may move.
2. Two lanes only (Ángeles, Villa).
3. No prologue: Villa's lane starts with his 10:05 advance.
4. Loreto is **in** (user correction, replacing the earlier "dropped"): Ángeles' guns advance to it and fire
   from it. It is a non-clickable pin placed from the user's circle on a screenshot, about (45, -65) on the
   board, north-north-east of the cathedral. The sourced "Loreto taken at 10:25, 25 minutes in" event is left
   out of the Villa lane, because it would replace the caption of Villa's own march.
5. Ángeles' position at 10:00 is Vetagrande (the cannons), flagged `inferred`.
6. Centro de Zacatecas is added as a fifth pin (the `cathedral` hotspot) as Villa's last objective.

**Historical flag:** the sources place Villa and Ángeles together near Cerro de Loreto in the north. Villa
attacking El Grillo from the south-west station is the author's direction, so those events are tagged `inferred`.

## Appendix — draft events (to review; every time is adjustable)

| Time | Lane | Event | Shot | Source |
|---|---|---|---|---|
| 10:00 | angeles | One cannon shot; Ángeles' guns at Vetagrande open fire on La Bufa (arrow Vetagrande → La Bufa until 11:00) | angeles-artillery | shot and 40 guns sourced; targets inferred |
| 10:05 | villa | Villa's column advances from the railway station (south-west) on Cerro del Grillo (flag marches until 11:00) | march-villa-grillo | inferred |
| 11:00 | villa | Villa attacks Cerro del Grillo (arrow until 13:00) | elgrillo | inferred |
| 11:00 | angeles | Guns advance from Vetagrande to Cerro de Loreto (flag marches until 12:00) | march-vetagrande-loreto | sourced (guns advanced to Loreto); timing inferred |
| ~12:00 | villa | Cerro de la Sierpe taken, 300 m NW of El Grillo | elgrillo | sourced |
| 12:00 | angeles | From Cerro de Loreto, Ángeles' guns attack La Bufa and El Grillo (arrows until 18:00 and 13:00) | elgrillo | inferred |
| ~13:00 | villa | El Grillo falls; federal artillery out of ammunition; federals running through the streets | elgrillo | sourced |
| 13:00 | villa | Villa's column advances from El Grillo on the city centre (flag marches until 14:00) | cathedral | inferred |
| 14:00 | villa | Villa's column reaches the city centre; fighting in the streets | cathedral | inferred (street fighting after midday sourced) |
| ~18:00 | villa | La Bufa falls; federal retreat collapses | labufa | sourced (dossier) |

## Update, 2026-10-09 evening (supersedes the marching-flags part and the appendix above)

The author reshaped the timeline and the units after this spec was written: **one lane** (no Ángeles/Villa split), the control row along
the top and the caption in the bottom-right corner, no speed buttons; the glowing flags, the formations of bars and the unit name chips
are gone, and the units are the **soldier and cannon statues** themselves, which walk, turn, flash at their rifles and fire (the guns from
their barrel mouths). New actors: Pánfilo Natera's army (south-west) and the federal groups, which fire back, fall back and finally leave the map. The
day's events are in `src/timeline/events.ts` and summarised in `progress/HANDOFF.md`, which are the authority now.
