# La Toma de Zacatecas

An interactive 3D map of the **1914 Battle of Zacatecas**, built with React and three.js. The map is a
Blender-made diorama (terrain from real elevation data, hand-modelled landmarks, soldiers and artillery)
that you can orbit, pan and zoom in the browser.

It started as the map layer for a short documentary and is being built as a reusable engine for
map-based historical pieces: content is data-driven, runs in a plain browser, needs no backend, and is
meant to work on a tablet or a museum kiosk PC.

## Status

**Milestone 1, the scene foundation, is done:** the baked terrain and landmark/unit models render with a
bounded orbit/pan/zoom/WASD camera, and the build pipeline from Blender is in place.

Planned next (see [the design spec](docs/superpowers/specs/2026-09-30-interactive-map-design.md)): location
pins that fly the camera to each place and open a short video, a battle timeline with faction-coloured
movement arrows, and idle/attract behaviour for kiosks.

## The 3D assets are not in this repository

The models and textures are exported from Blender and are not committed (they are large binaries, and
some are AI-generated or derived from archival material, so they are not covered by this repo's MIT
license). The app expects them in `public/` and **will show an error screen naming the missing file until
you provide them.**

To run it you need an export folder laid out like this:

```
<exports>/
  meshes/
    floor_baked.glb        terrain + wooden frame, textures embedded (Draco-compressed GLB)
    glows.glb              the red/blue faction decals (alpha-blended, emissive, draped on the terrain)
    compass.glb            vintage compass rose plane on the terrain, upper-right corner
```

The models are listed in [`src/scene/assets.json`](src/scene/assets.json). Edit that file to use your own
set; the only hard requirements are a floor mesh (with its textures embedded in the GLB) and any number of piece GLBs
whose node transforms already hold their world positions (1 unit = 10 real metres, glTF Y-up).

## Run

```bash
npm install
EXPORTS_DIR=/path/to/exports npm run sync-assets   # copies the models + the Draco decoder into public/
npm run dev                                         # http://localhost:5173
```

`EXPORTS_DIR` defaults to `../Blender/Exports`, the layout of the original production workspace.

**Controls:** left-drag pan · right-drag orbit · scroll zoom · WASD / arrow keys pan. The camera stays on
the board, above the terrain, and within a zoom range that always lets you see the whole map.

## The units: formations of bars

The map has no 3D statues or props (they were retired on 2026-10-14; the files are in `_archive/statues/`). Only the floor, the
ground glows and the compass are models, about 4.6 MB in all.

- **The units are drawn as a force of outlined rectangular bars** with a lit chevron at its head, a flag and a name chip
  (`src/scene/Force.tsx`; infantry in a front of three lines, the artillery as a line of guns with caissons; yellow, red and blue by
  side). A force walks its unit's marches as a column, deploys when it stops, sparkles while the unit fires, and its guns' barrels
  are where the shells leave from (`GUN_MUZZLES` in `gunFire.ts`).
- **Ángeles' artillery is one formation until 10:30**, when it divides: half marches to Cerro de Loreto (there at 11:00) and half
  stays at Vetagrande. (The two halves are two units of the timeline, `angeles` and `angeles-rear`; `Force` draws each its half of the
  guns, from the same place, so they are the battery until the first half sets off.)

## Languages: Spanish and English

The page opens in the visitor's language: Spanish if any of the browser's languages is Spanish, English otherwise. The **ES/EN
button** next to the sound button switches it (remembered in `localStorage`, the page reloads), and **`?lang=es`** or **`?lang=en`**
in the address forces one (it wins over the saved choice). `src/i18n.ts` has the detection; interface strings are written where they
are used with `t('español', 'English')`, and events and units carry `{ es, en }` pairs.

Media are per language, with Spanish as the fallback: a video in `VIDEO_SOURCES` (`src/video/videos.ts`) and a line in
`NARRATION_SOURCES` (`src/timeline/narrationLines.ts`) take an optional `en` file. Today only the 12:00 film has an English cut
(`videos/villistas-en.mp4`); the other films and the map narration are Spanish in both languages. To add one:
`npm run optimize-video -- <master.mov> <id>-en`, then `en: { src: 'videos/<id>-en.mp4' }` on its source (the Spanish poster is
reused); for a narration line, `en: { src, seconds }` (the day is paced by the length of the lines).

## Updating models from Blender

After re-exporting (floor, pieces, or both) run `npm run sync-assets` again and reload. It checks the
export folder against `src/scene/assets.json` and reports, by name, a model that is missing, renamed,
unused, empty or still being written. If it refuses to sync, your previous working copy is left untouched.

To add a piece: export its `.glb` and add one line to `assets.json`.

[`Blender/heightmaps/bake_floor_mesh.py`](docs/superpowers/specs/2026-10-01-scene-foundation-design.md#stage-0--blender-bake-the-floor-done-2026-10-01)
describes how the terrain is baked from the height map into a 100k-triangle mesh (the script itself lives
in the production workspace, not in this repo).

## Deploy (kiosk or any static host)

```bash
npm run sync-assets   # after every Blender re-export
npm run build         # public/ is copied into dist/ at build time, so rebuild after each sync
```

Serve `dist/` with any static web server (`npm run preview` for a quick local check). There is no
backend, but browsers do not allow opening `dist/index.html` straight from disk (`file://`): the page
shows a hint instead of the map. The Draco decoder is bundled, so the app works fully offline.

## How it works

| Piece | What it does |
|---|---|
| `scripts/sync-assets.mjs` | Validates and copies the exports into `public/`; swaps each folder in whole so a failed sync never leaves a half-written copy |
| `src/i18n.ts` | The page's language (browser, saved choice, `?lang=`) and `t` / `pick` / `byLang` |
| `src/scene/Force.tsx`, `formation*.ts`, `unitLabel.ts`, `flagCloth.ts` | A unit as a formation of bars with a chevron, a flag and a name chip  |
| `src/scene/Arrow.tsx`, `chevronArrow.ts` | The arrow of an attack: a chain of chevrons on the terrain, drifting toward the target |
| `src/scene/Terrain.tsx` | Loads the baked floor, applies the base-colour texture, reports the board's bounds |
| `src/scene/Piece.tsx` | Renders one piece GLB exactly as exported |
| `src/camera/MapCamera.tsx` | Frames the camera from the loaded bounds, clamps panning, zoom and height, applies keyboard pan |
| `src/camera/math.ts`, `keyboard.ts` | Pure, unit-tested camera and keyboard logic |
| `src/ui/` | Loader and an error screen for missing or broken assets |

Stack: Vite, React 19, TypeScript, three.js, @react-three/fiber, @react-three/drei, vitest.

## Development

```bash
npm test             # unit tests (camera maths, keyboard rules, asset sync); no assets needed
npm run typecheck
npm run build
```

The asset-manifest test checks every model the app requests exists in `public/`; it is skipped (and
reported as skipped) until you have run `sync-assets`.

Design documents and the implementation plan are in [`docs/superpowers/`](docs/superpowers/).

## License

Code: [MIT](LICENSE) © 2026 Phantasma Labs. The 3D models, textures, video and research material that go
with this project are not included and are not covered by this license.
