# Scene Foundation — Milestone 1 Design

Extends [2026-09-30-interactive-map-design.md](2026-09-30-interactive-map-design.md).
That spec defines the whole v1 experience; this one covers only the first
build milestone: getting the Blender-exported diorama rendering correctly in
the browser with a bounded, usable camera.

**Revision (2026-10-01):** the floor is a **baked, real-geometry mesh**, not a
flat plane displaced in the shader. This adds a Blender export stage (Stage 0)
ahead of the app work. Reason: with shader displacement the CPU never sees the
terrain's real heights, so raycasting, timeline arrows on the terrain, pin
placement and camera ground-collision would all need a separate CPU height
sampler, and the 8-bit height PNG can band on slopes. Baked geometry also
allows adaptive triangle density (detail on La Bufa's cliffs, less on flat
ground).

## Goal

`npm run dev` in `app/` shows the textured Zacatecas terrain with the
Cathedral, La Bufa fort, El Grillo emplacement, Vetagrande cannons and both
factions' soldiers in place. The user can orbit, pan, zoom and WASD-pan without
leaving the board or breaking the geometry.

## Out of scope

Pins and `locations.json`, the video overlay, the timeline scrubber, idle
orbit / attract mode, shadows, and any terrain re-texturing (the base colour
texture is reused unchanged).

## Stage 0 — Blender: bake the floor (DONE 2026-10-01)

Done through the Blender MCP in the open `Map_Layout.blend`. Non-destructive:
`Floor` and every existing object were left untouched. The reproducible script
is [Blender/heightmaps/bake_floor_mesh.py](../../../../Blender/heightmaps/bake_floor_mesh.py)
(~25 s); it leaves one small object, `floor_baked`, in a `FloorBake` collection.

**What it does.** `Floor` is only a 16 x 16 plane; its relief lives in the
material's Displacement node (32-bit `Floor_Height.exr`, `world_z = 5.8193 +
(R - 0.015931) x 39.3821`). The script samples that formula on a 1024 x 1741
reference grid, decimates it (collapse, footprint border protected) and
recomputes the UVs exactly from vertex positions (the floor's UVs are linear in
xy). It exports `floor_baked.glb` with the same node transform as `floor.glb`.

**Deliverables** (in `Blender/Exports/`): `meshes/floor_baked.glb` (360 KB,
100,000 triangles, 52,766 vertices, Draco, plain white `floor` material, no
embedded textures) and `meshes/floor_baked.json` (sidecar). The base colour
texture `textures/floor/floor_basecolor.jpg` is reused as-is. `floor.glb`,
`floor.json` and the displacement textures remain as a fallback.

**Decisions made from measurements, not guesses:**

- **Budget 100k triangles, not 250k.** Height error vs the EXR was identical at
  60k, 100k and 250k (p95 0.002 units); the heightfield is smooth SRTM-derived
  data, so extra triangles buy nothing. 100k is 9x lighter than the old
  890,880-triangle displaced grid.
- **No normal map.** A tangent-space normal map baked from the reference onto
  the low-poly mesh came out nearly flat (std ~0.3 degrees). In a neutral
  grazing-light Cycles comparison against the reference, the low-poly mesh with
  smooth vertex normals was closest (mean luminance difference 0.0005, p95
  0.003) and adding the baked map made it slightly worse (0.0012). So the
  terrain uses vertex normals and the base colour only; the baked PNG was
  discarded.
- **Base colour factor is 1.0.** The exporter's default 0.8 tint would have
  darkened the texture 20% in three.js; the script sets white.

**Stage 0 results:**

- Vertical error vs the EXR on the *exported file*, re-imported (Draco decode
  included), 3000 random points, 0 misses: p50 0.004, p95 0.009, p99 0.009,
  max 0.062 units (1 unit = 10 m). Acceptance was p95 <= 0.2.
- Under every piece's base the baked surface differs from the EXR surface by
  <= 0.031 units, so seating is unchanged from the displaced version. (The
  original acceptance idea, "every base within 0.3 units of the surface", does
  not apply: several pieces were authored sunk into or above the heightfield,
  e.g. La Bufa fort's base is ~4.9 units below the EXR surface. Close-up
  Cycles renders with the real texture show the fort, cannons and El Grillo
  emplacement reading as properly seated.)
- Footprint, node position and UVs identical to `floor.glb`.

## Inputs to the app

All from `Blender/Exports/`. Units: 1 unit = 10 real meters; glTF Y-up. Every
node carries its world transform, so nothing is re-centred or re-scaled in the
app. All GLBs use `KHR_draco_mesh_compression`.

| File | Contents |
|---|---|
| `meshes/floor_baked.glb` | baked terrain (Stage 0), 100k triangles, no embedded textures |
| `meshes/cathedral.glb` | `Piece_Cathedral` |
| `meshes/labufa_fort.glb` | `Piece_LaBufa_Fort` |
| `meshes/elgrillo_emplacement.glb` | `Piece_ElGrillo_Emplacement` |
| `meshes/vetagrande_cannons.glb` | `Piece_Vetagrande_Cannon_01..05` |
| `meshes/soldiers_federal.glb` | 2 groups (El Grillo, La Bufa) |
| `meshes/soldiers_villista.glb` | 3 groups (El Grillo, La Bufa, Vetagrande) |
| `meshes/floor_baked.json` | authoritative material settings for the baked floor |
| `textures/floor/floor_basecolor.jpg` (4096) | floor base colour (no normal map; see Stage 0) |

The pieces carry their own embedded textures. Only the floor needs external ones.

## Stack

Vite + React + TypeScript, `three`, `@react-three/fiber`, `@react-three/drei`.
Static build, no backend, per the parent spec. `dist/` must be served over HTTP (browsers block module
scripts and model fetches from `file://`); the README documents this and `index.html` shows a hint until the
app mounts.

## Asset delivery

`npm run sync-assets` (a small Node script in `app/scripts/`) copies:

- `Blender/Exports/meshes/*.glb` except the legacy `floor.glb` -> `app/public/models/`
- `Blender/Exports/textures/floor/floor_basecolor.jpg` -> `app/public/textures/floor/`
- `three/examples/jsm/libs/draco/gltf/*` -> `app/public/draco/`

The app is self-contained afterwards and works offline (kiosk). The synced
directories are gitignored (binaries); re-run the script after each Blender
export. The Draco decoder is hosted locally instead of drei's default CDN, so
the app never needs internet.

## Components

Each unit has one job and a narrow interface.

- **`assets.json` / `sceneAssets.ts`** — manifest of the floor model + texture and an array of
  `{ id, url }` for the six piece GLBs, in JSON so `npm run sync-assets` can cross-check it against what
  Blender exported (missing, renamed, unused, empty or half-written files are reported by name, and a failed
  sync leaves the previous `public/` copy untouched). Adding a piece is one line in `assets.json`.
- **`Terrain`** — loads `floor_baked.glb` and `floor_basecolor.jpg`; applies
  the `floor_baked.json` settings (`flipY = false`, sRGB, anisotropy and
  mipmaps; no normal map, no displacement). Real geometry, so normal frustum
  culling and normal raycasting. Exposes the floor's world bounding box, and fails loudly (error screen naming
  the file) if the export contains no geometry.
- **`Piece`** — generic: loads one GLB via drei `useGLTF` (local Draco path)
  and renders its scene as-is, preserving every node's transform.
- **`MapCamera`** — perspective camera framed like the Blender diorama camera
  (~29 degrees from top-down, 50 mm-equivalent field of view), drei
  `MapControls`. Target, zoom distance and polar angle are clamped to the
  floor's bounds. A `useKeyboardPan` hook adds arrow keys / WASD panning at the
  current zoom, clamped identically (parent spec, "Keyboard navigation"). The zoom cap scales with the
  loaded floor (a wider floor can still be seen whole in a narrow window) and the camera is never allowed
  below the highest terrain point, whatever relief the floor has.
- **`Lighting`** — warm directional key light, hemisphere fill, background
  colour matched to the terrain edge. No shadows.
- **`Loader`** — DOM overlay driven by drei `useProgress`.
- **`App`** — `<Canvas>` + `<Suspense>` wiring `Terrain`, `Piece[]`,
  `MapCamera`, `Lighting`, and the `Loader`.

Data flow: `sceneAssets.ts` -> `App` -> `Piece[]`; `Terrain` -> bounds ->
`MapCamera`. Nothing else is shared. A `getHeightAt(x, z)` helper (raycast
down against the terrain mesh) is **not** built in this milestone; baked
geometry means it is a few lines whenever pins or arrows need it.

## Project layout

```
app/
  scripts/sync-assets.mjs
  public/{models,textures,draco}/      # synced, gitignored
  src/
    main.tsx  App.tsx
    scene/{Terrain,Piece,Lighting}.tsx
    scene/sceneAssets.ts
    camera/{MapCamera.tsx,useKeyboardPan.ts}
    ui/Loader.tsx
```

## Known risks and decisions

1. **Origin mismatch.** `Blender/PIPELINE.md` says the Cathedral is the world
   origin, but `cathedral.glb` sits at about (-22, 14, -262) and the old floor
   is centred at (23.6, 5.8, -327). The exports have been re-laid-out since
   that doc was written. The camera therefore frames from the floor's computed
   bounds, never from a hardcoded origin.
2. **Piece seating is inherited, not introduced.** Stage 0 showed the baked
   surface matches the EXR to <= 0.031 units under every piece, so pieces sit
   exactly as they did against the displaced floor. Some were authored sunk
   into the heightfield (La Bufa fort ~4.9 units); that looked right in
   Blender renders but should be re-checked in the browser.
3. **Texture shading only.** Without a normal map the terrain's fine surface
   detail comes from the base colour texture (which has a visible ripple
   pattern baked in) plus vertex normals; this is a property of the existing
   texture, not of the bake.
4. **Memory/perf.** A 4096 base colour plus a 100k-triangle terrain is far
   lighter on the GPU than the previous 890k-triangle displaced grid. Still
   unmeasured on kiosk hardware.
5. **Blender file state.** The `.blend` on disk was saved (by the user) while
   the 1.78M-quad temporary reference was still in the scene, which added ~95
   MB (452 -> 547 MB). The live scene is clean; re-saving removes it.
6. **Pre-existing doc drift.** The parent spec still calls texturing
   "unresolved" while the floor is now textured; `PIPELINE.md` has the stale
   origin. Neither is edited here beyond a short note in `PIPELINE.md` about the
   Stage 0 bake once it exists.

## Verification

Unit tests (vitest) cover only pure logic: the asset sync script and the camera
maths. There are no browser or visual automated tests (parent spec: none for
v1). Stage 0 was verified with the measured checks above. The app is verified by
running the dev server and driving it in a real (headless) Chrome:

- No console errors; the loader appears and then clears.
- Terrain shading consistent with the Blender render of the baked floor (not
  inverted); relief reads correctly.
- All six piece files render, seated on the terrain at their expected locations.
- Orbit, pan, zoom and WASD all stay inside the clamped bounds; no unintended
  void at the default framing.
- `npm run build` succeeds and the built output loads from `vite preview`.
