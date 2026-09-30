# La Toma de Zacatecas — Interactive Map Experience (v1 Design)

## Summary

Replace the linear 56-second documentary short with a non-linear, educational
web experience: a rich, animated vintage war-map of the 1914 Battle of
Zacatecas. The map is the only interactive surface — clicking/tapping a pin
opens a short AI-generated video (plus historical caption) for that location.
Everything outside the map itself (video, captions, audio) is passive
audiovisual media, not further interactive.

The project doubles as:
1. A standalone educational piece for Zacatecas' battle (v1 content).
2. A reusable template/engine for future map-based historical or museum
   pieces (via a data-driven content model, not a multi-tenant platform).
3. A portfolio showcase for the gen-AI video pipeline already built for the
   documentary (T2I → image-to-video → Topaz upscale → Nuke/AE finish).

## Goals

- Non-linear exploration of 5 locations via a single vintage map.
- Map feels alive: subtle idle animation on pin icons (miniature-style
  markers), layered parallax art, light atmospheric effects (drifting
  smoke/dust), smooth pan & zoom.
- Runs in a plain browser — desktop, tablet (touch), or a fullscreen museum
  kiosk PC. No backend, no accounts, no analytics for v1.
- Content (locations, captions, media) is data-driven so adding a 6th pin,
  swapping clips, or standing up a different historical map later is a data
  change, not a code change.

## Roadmap — Revised (2026-09-30): Proper 3D From v1

> **Supersedes the original two-phase plan below the divider.** Decision:
> the map renderer is Three.js/r3f from the start, not a later upgrade.
> Reason — a baked 2D painted board fundamentally cannot support real
> camera movement: panning/zooming over a flat image is a fake dolly (it
> magnifies pixels, it doesn't reveal geometry), and generating discrete
> painted frames per camera state won't hold together between cuts
> (lighting/proportions drift between AI generations). Real 3D geometry is
> the only way the camera continuously moves between pins without seams.

**Terrain/geometry pipeline (Blender):**
- Real-world DEM (SRTM, fetched via OpenTopoData) drives base terrain
  displacement, at true relative scale/position — see
  `Blender/heightmaps/zacatecas_dem.json` and `Blender/Source/Map_Layout.blend`.
- Iconic landmarks (La Bufa's mesa/cliff silhouette first; El Grillo and
  others as needed) are hand-sculpted on top of the DEM, carved into a
  blended "socket" rather than left as raw satellite noise, using real
  photo references (e.g. `ImageReference/cerrobufa.png`).
- City/Cathedral are greyboxed at the real center point (the Cathedral —
  22.7756°N, 102.5723°W — is local origin (0,0)).

**Texturing pipeline — camera projection, not UV/procedural:** matching
the VFX matte-painting technique already familiar from this project's
Nuke/AE pipeline. For each layer (terrain first, then landmarks, then
city), a stylized/painted reference image is generated (Nano Banana, via
the Magnify/Magnific connector) from the exact diorama camera viewpoint,
then camera-projected onto that layer's geometry in Blender. This keeps
the painted-board illustration look (see
[Research/VisualReferences.md](../../../Research/VisualReferences.md))
while the underlying asset stays real, continuity-safe 3D geometry.
Terrain material direction: semi-arid/desert, no vegetation layer needed
(matches the real high-plateau climate and reference photography).

**Why this doesn't change the app's interaction model:** the pin-
selection → camera-transition → video-overlay flow and `locations.json`
are unaffected — only the map's renderer and asset pipeline changed from
the original plan below. Video clips remain flat 1920x1080 — no 3D
needed there; the only seam is "3D map camera move → cut to flat video,"
which was already the design.

---

## Original Roadmap (superseded, kept for record)

- **Phase 1 (this spec): 2D.** PixiJS map, illustrated/layered board art
  (see [Research/VisualReferences.md](../../../Research/VisualReferences.md)),
  flat pan/zoom camera with a settle-on-selection move into each pin.
  Ships the 5 MVP pins end to end.
- **Phase 2 (future, not this build): 3D upgrade.** Once Phase 1 proves
  the content and art direction, upgrade the map renderer to Three.js/r3f
  — real camera dolly through 3D space into a pin before cutting to
  video, terrain and pieces modeled (Blender) and rendered in an
  illustrated/toon-shaded (NPR) style rather than photoreal. Bigger
  pipeline (3D modeling/rigging + custom shaders) and a tighter kiosk/
  tablet performance budget, so it's a deliberate later decision, not a
  default.
- **Why this doesn't change how Phase 1 is built:** the pin-selection →
  camera-transition → video-overlay flow is implemented as its own module,
  separate from how the map renders. `locations.json` and that
  interaction flow stay the same across the upgrade; only the renderer
  (PixiJS → Three.js) and the art assets change. The Phase 2 upgrade
  should be additive, not a rewrite.

## Non-Goals (v1)

- No 360°/WebXR/VR. All media is flat 1920x1080 video.
- No interactivity inside the media itself (no chapter markers, hotspots in
  video, etc.) — video plays, user closes it, returns to map.
- No CMS/admin UI for editing content — content is edited by hand in a JSON
  file and media files on disk.
- No multi-language site chrome beyond bilingual (ES/EN) caption text.
- No enforced clip-length limit in code. Production target is ~15s clips,
  but a pin can point to a longer "mini-edit" without any rework.

## Architecture

> **Updated (2026-09-30) per the Roadmap decision above:** the map canvas
> is Three.js/r3f, not PixiJS. The PixiJS rationale immediately below is
> kept for the record (still correct reasoning for a 2D-only approach)
> but no longer describes what's being built.

- **Stack:** React + Vite (static build, no server required) +
  Three.js/react-three-fiber for the map scene (real 3D terrain, built in
  Blender, textured via camera-projected AI-generated stylized images —
  see Roadmap) + plain HTML5 `<video>` for playback.
- ~~Why PixiJS over DOM/CSS for the map~~ *(superseded)*: the map needs
  layered parallax art, many small animated icons, and atmospheric
  particle effects (smoke, dust) while staying smooth on modest kiosk/
  tablet hardware. PixiJS (WebGL-accelerated 2D canvas) is built for
  exactly this and is meaningfully simpler to build and maintain than a
  full 3D engine — reasoning that held until the camera-continuity problem
  (see Roadmap) made real 3D geometry necessary regardless of the extra
  complexity.
- **Why plain `<video>` over a WebGL video texture:** media is flat 1080p,
  so there's no projection/sphere math to justify piping video through
  WebGL. A DOM `<video>` in a modal overlay is simpler, more robust across
  browsers/kiosk hardware, and easier to debug. Still true under Three.js
  — the video overlay stays a separate DOM layer, not a texture in the 3D
  scene.

### Components

- **`MapScene` (Three.js/r3f canvas)** — renders the 3D terrain (Blender-
  built, camera-projected painted texture) and pin pieces. Handles
  orbit/pan/zoom camera control (clamped to sane bounds), pin idle
  animation (gentle bob/glow/pulse loop), and pin selection → camera
  dolly transition → emits the selected location id.
- **`MediaOverlay` (DOM)** — full-screen modal shown when a pin is
  selected. Plays the location's video (autoplay with sound on open),
  shows title + bilingual caption text, and a close control that returns to
  the map. On a kiosk, an idle timeout while the overlay is open should
  auto-close back to the map.
- **`locations.json`** — the single content manifest driving the app (see
  Data Model below). No other code changes needed to add/edit/remove a pin.
- **Kiosk/attract behavior** — after a period of inactivity on the map
  (no pan/zoom/tap), the view can recenter/zoom to a default "attract"
  framing. Actual kiosk launch (fullscreen browser, auto-restart) is a
  museum-hardware/IT concern outside this app's scope; the app just needs
  to behave correctly if left running.

### Data Model (`locations.json`)

```json
[
  {
    "id": "vetagrande",
    "name": "Vetagrande",
    "subtitle": "Ángeles prepara el asalto",
    "mapPosition": { "x": 0.32, "y": 0.18 },
    "icon": "icons/cannon-marker.png",
    "caption": {
      "es": "...",
      "en": "..."
    },
    "media": {
      "src": "media/vetagrande.mp4",
      "poster": "media/vetagrande-poster.jpg"
    }
  }
]
```

- `mapPosition` is normalized (0–1) relative to the map image, so pins stay
  correctly placed regardless of map resolution or zoom level.
- `media.src` has no duration constraint — the player just plays whatever
  file is there.

## MVP Content — 5 Pins

Pulled from the existing [LocationBible.md](../../../Writer/LocationBible.md)
and the original pitch, with one swap agreed in discussion:

1. **Vetagrande** — Ángeles prepares the artillery assault.
2. **Zacatecas Valley (tactical overview)** — the isometric/strategic view
   of El Grillo and La Bufa.
3. **El Grillo Slopes** — the chaotic infantry assault.
4. **La Bufa Heights** — combat, then modern-day ruins.
5. **Zacatecas City Center** — *tentative, to be confirmed.* Proposed as
   the 5th pin in place of the earlier "Drafting Studio" idea, likely
   framed as the city itself during/after the battle (or a then-vs-now
   beat), but exact content/angle isn't locked yet.

The `Writer/*.md` files (Overview, Script, Screenplay, Character/Location
Bibles) were written for the linear documentary cut and are explicitly
work-in-progress — they're a starting reference for tone and visual
direction, not a frozen source of truth. They will likely be revised to fit
the non-linear map structure as content is produced per-pin.

Bilingual (ES/EN) captions for each pin will be drafted from
[Research/La Batalla de Zacatecas (1914).md](../../../Research/La%20Batalla%20de%20Zacatecas%20%281914%29.md)
as a first pass, for the user to edit/approve before shipping.

## Project Structure

New `app/` directory at the root of this working directory, separate from
the existing production pipeline folders (AFX, Nuke, PSD, Topaz, etc.):

```
app/
  src/            # React + PixiJS source
  public/
    map/          # vintage map art, parallax layers
    icons/        # pin marker sprites
    media/        # final video clips + posters (pulled from Exports/)
    locations.json
  docs/           # this spec + future design docs
```

`app/` gets its own git repository (the production asset folders are not
suited to git — large binaries, no existing VCS). Final exported clips are
copied from `Exports/` into `app/public/media/`, not duplicated as raw
AE/Nuke project files.

## Testing / Validation (v1)

No automated test suite for v1 — this is a small, content-driven front-end.
Manual QA checklist before each milestone:
- Each pin opens the correct video with correct caption text.
- Pan/zoom stays within bounds on desktop (mouse) and touch (tablet).
- Overlay close returns cleanly to the map in the same pan/zoom state.
- Idle/attract behavior triggers correctly after inactivity.

## Open Items

- Confirm the 5th pin (Zacatecas City Center vs. alternative).
- Confirm/edit drafted bilingual captions once written.
- Confirm target kiosk hardware (if/when a museum display is scheduled) —
  may affect performance tuning but not the core architecture.
