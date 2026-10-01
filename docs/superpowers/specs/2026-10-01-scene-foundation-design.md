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

## Stage 0 — Blender: bake the floor

Done through the Blender MCP in the open `Map_Layout.blend`. Non-destructive:
`Floor` and all existing objects stay untouched, the work happens on a
duplicate in a new `FloorBake` collection, and the `.blend` is not saved unless
the user says so.

**Source of truth for height:** the 32-bit `Blender/textures/Floor_Height.exr`
(not the 8-bit PNG), with the same displacement scale and bias recorded in
`floor.json` (scale 39.3821, bias -0.6274 relative to the floor node).

Steps:

1. **High-res reference:** duplicate `Floor`, subdivide to the current
   512 x 870 grid density, apply a Displace modifier using the EXR. This is the
   reference surface (it also stands in for what the shader displacement showed).
2. **Low-poly bake target:** decimate a copy of the reference to a budget of
   about **250k triangles** (collapse, UVs preserved; the floor is a single UV
   island so there are no seams to protect). The budget is a starting point;
   tune after viewing the result.
3. **Normal map re-bake:** bake a tangent-space normal map from the high-res
   reference onto the low-poly target (2048 x 2048, OpenGL +Y). The old
   `floor_normal.png` encodes the full heightfield slope; reused on real
   geometry it would double-count every slope the mesh already carries. The new
   map holds only the residual detail.
4. **Export:** `floor_baked.glb` (Draco, geometry only, same node-transform
   convention as the other pieces so everything lines up), plus
   `floor_baked.json` (sidecar in the same style as `floor.json`) and
   `textures/floor/floor_baked_normal.png`. `floor_basecolor.jpg` is reused
   as-is. The existing `floor.glb`, `floor.json` and displacement textures are
   left in place as a fallback.

**Stage 0 acceptance** (measured, not eyeballed):

- Vertical error of the baked mesh vs the EXR heightfield at 1,000 random
  points: p95 <= 0.2 units (2 m), reported with p50 and max.
- Every piece's base (La Bufa fort, El Grillo emplacement, Cathedral, cannons,
  soldier groups) sits within 0.3 units of the baked surface: not floating, not
  buried.
- Blender render of the baked floor with the new normal map vs the original
  displaced `Floor`: visually matching shading, no inverted relief.
- Triangle count and `floor_baked.glb` size reported.

If acceptance fails at the 250k budget, raise the budget and re-run before any
app work depends on the file.

## Inputs to the app

All from `Blender/Exports/`. Units: 1 unit = 10 real meters; glTF Y-up. Every
node carries its world transform, so nothing is re-centred or re-scaled in the
app. All GLBs use `KHR_draco_mesh_compression`.

| File | Contents |
|---|---|
| `meshes/floor_baked.glb` | baked terrain (Stage 0), no embedded textures |
| `meshes/cathedral.glb` | `Piece_Cathedral` |
| `meshes/labufa_fort.glb` | `Piece_LaBufa_Fort` |
| `meshes/elgrillo_emplacement.glb` | `Piece_ElGrillo_Emplacement` |
| `meshes/vetagrande_cannons.glb` | `Piece_Vetagrande_Cannon_01..05` |
| `meshes/soldiers_federal.glb` | 2 groups (El Grillo, La Bufa) |
| `meshes/soldiers_villista.glb` | 3 groups (El Grillo, La Bufa, Vetagrande) |
| `meshes/floor_baked.json` | authoritative material settings for the baked floor |
| `textures/floor/floor_basecolor.jpg` (4096) + `floor_baked_normal.png` (2048) | floor textures |

The pieces carry their own embedded textures. Only the floor needs external ones.

## Stack

Vite + React + TypeScript, `three`, `@react-three/fiber`, `@react-three/drei`.
Static build, no server, per the parent spec.

## Asset delivery

`npm run sync-assets` (a small Node script in `app/scripts/`) copies:

- `Blender/Exports/meshes/*` -> `app/public/models/`
- `Blender/Exports/textures/floor/*` -> `app/public/textures/floor/`
- `three/examples/jsm/libs/draco/gltf/*` -> `app/public/draco/`

The app is self-contained afterwards and works offline (kiosk). The synced
directories are gitignored (binaries); re-run the script after each Blender
export. The Draco decoder is hosted locally instead of drei's default CDN, so
the app never needs internet.

## Components

Each unit has one job and a narrow interface.

- **`sceneAssets.ts`** — manifest: an array of `{ id, url }` for the six piece
  GLBs. Adding a piece to the scene is one line.
- **`Terrain`** — loads `floor_baked.glb` and the two floor textures; applies
  the `floor_baked.json` settings (`flipY = false`; base colour sRGB; normal
  map `NoColorSpace` with the `normalScale` the sidecar prescribes; anisotropy
  and mipmaps on the base colour). Real geometry, so normal frustum culling
  and normal raycasting. Exposes the floor's world bounding box.
- **`Piece`** — generic: loads one GLB via drei `useGLTF` (local Draco path)
  and renders its scene as-is, preserving every node's transform.
- **`MapCamera`** — perspective camera framed like the Blender diorama camera
  (~29 degrees from top-down, 50 mm-equivalent field of view), drei
  `MapControls`. Target, zoom distance and polar angle are clamped to the
  floor's bounds. A `useKeyboardPan` hook adds arrow keys / WASD panning at the
  current zoom, clamped identically (parent spec, "Keyboard navigation").
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
2. **Pieces were seated against the displaced surface.** The baked mesh is an
   approximation of that surface; Stage 0's 0.3-unit seating check guards
   against floating or buried pieces.
3. **Normal map orientation.** The baked normal map must be tangent-space
   OpenGL (+Y); with `flipY = false` three.js may need `normalScale.y = -1`
   (the old floor needed it). The sidecar records whichever is verified, and the
   app reads it from there.
4. **Memory/perf.** A 4096 base colour plus a ~250k-triangle terrain is far
   lighter on the GPU than the previous 890k-triangle displaced grid. Still
   unmeasured on kiosk hardware.
5. **Pre-existing doc drift.** The parent spec still calls texturing
   "unresolved" while the floor is now textured; `PIPELINE.md` has the stale
   origin. Neither is edited here beyond a short note in `PIPELINE.md` about the
   Stage 0 bake once it exists.

## Verification

No automated tests (parent spec: none for v1). Stage 0 is verified with the
measured checks above. The app is verified by running the dev server and using
the built-in browser:

- No console errors; the loader appears and then clears.
- Terrain shading consistent with the Blender render of the baked floor (not
  inverted); relief reads correctly.
- All six piece files render, seated on the terrain at their expected locations.
- Orbit, pan, zoom and WASD all stay inside the clamped bounds; no unintended
  void at the default framing.
- `npm run build` succeeds and the built output loads from `vite preview`.
