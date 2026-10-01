# Scene Foundation — Milestone 1 Design

Extends [2026-09-30-interactive-map-design.md](2026-09-30-interactive-map-design.md).
That spec defines the whole v1 experience; this one covers only the first
build milestone: getting the Blender-exported diorama rendering correctly in
the browser with a bounded, usable camera.

## Goal

`npm run dev` in `app/` shows the textured, displaced Zacatecas terrain with
the Cathedral, La Bufa fort, El Grillo emplacement, Vetagrande cannons and
both factions' soldiers in place. The user can orbit, pan, zoom and WASD-pan
without leaving the board or breaking the geometry.

## Out of scope

Pins and `locations.json`, the video overlay, the timeline scrubber, idle
orbit / attract mode, CPU-side terrain height sampling, shadows, and any
terrain texturing work (the floor textures are already exported).

## Inputs

All from `Blender/Exports/`. Units: 1 unit = 10 real meters; glTF Y-up. Every
node already carries its world transform, so nothing is re-centred or
re-scaled in the app. All GLBs use `KHR_draco_mesh_compression`.

| File | Contents |
|---|---|
| `meshes/floor.glb` | 718.3 x 1224.5 plane, 512x870 segments, no embedded textures |
| `meshes/cathedral.glb` | `Piece_Cathedral` |
| `meshes/labufa_fort.glb` | `Piece_LaBufa_Fort` |
| `meshes/elgrillo_emplacement.glb` | `Piece_ElGrillo_Emplacement` |
| `meshes/vetagrande_cannons.glb` | `Piece_Vetagrande_Cannon_01..05` |
| `meshes/soldiers_federal.glb` | 2 groups (El Grillo, La Bufa) |
| `meshes/soldiers_villista.glb` | 3 groups (El Grillo, La Bufa, Vetagrande) |
| `meshes/floor.json` | Authoritative material settings for the floor |
| `textures/floor/floor_{basecolor.jpg,normal.png,height.png}` | 4096 / 2048 / 2048 |

The pieces carry their own embedded textures. Only the floor needs external
ones.

## Stack

Vite + React + TypeScript, `three`, `@react-three/fiber`, `@react-three/drei`.
Static build, no server, per the parent spec.

## Asset delivery

`npm run sync-assets` (a small Node script in `app/scripts/`) copies:

- `Blender/Exports/meshes/*` -> `app/public/models/`
- `Blender/Exports/textures/floor/*` -> `app/public/textures/floor/`
- `three/examples/jsm/libs/draco/gltf/*` -> `app/public/draco/`

The app is self-contained afterwards and works offline (kiosk). The synced
directories are gitignored (~30 MB of binaries); re-run the script after each
Blender export. The Draco decoder is hosted locally instead of drei's default
CDN, so the app never needs internet.

## Components

Each unit has one job and a narrow interface.

- **`sceneAssets.ts`** — manifest: an array of `{ id, url }` for the six piece
  GLBs. Adding a piece to the scene is one line.
- **`Terrain`** — loads `floor.glb` and the three floor textures; applies the
  `floor.json` settings: `flipY = false`; base colour sRGB; normal and height
  `NoColorSpace`; `normalScale = (1, -1)`; `displacementScale = 39.3821`,
  `displacementBias = -0.6274`; `frustumCulled = false`; anisotropy and
  mipmaps on the base colour. Exposes the floor's world bounding box
  (computed from the un-displaced geometry plus the displacement range).
- **`Piece`** — generic: loads one GLB via drei `useGLTF` (local Draco path)
  and renders its scene as-is, preserving every node's transform.
- **`MapCamera`** — perspective camera framed like the Blender diorama camera
  (~29 degrees from top-down, 50 mm-equivalent field of view), drei
  `MapControls`. Target, zoom distance and polar angle are clamped to the
  floor's bounds. A `useKeyboardPan` hook adds arrow keys / WASD panning at the
  current zoom, clamped identically (parent spec, "Keyboard navigation").
- **`Lighting`** — warm directional key light, hemisphere fill, background
  colour matched to the terrain edge. No shadows.
- **`Loader`** — DOM overlay driven by drei `useProgress`; the first load is
  ~30 MB.
- **`App`** — `<Canvas>` + `<Suspense>` wiring `Terrain`, `Piece[]`,
  `MapCamera`, `Lighting`, and the `Loader`.

Data flow: `sceneAssets.ts` -> `App` -> `Piece[]`; `Terrain` -> bounds ->
`MapCamera`. Nothing else is shared.

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
   origin, but `cathedral.glb` sits at about (-22, 14, -262) and the floor is
   centred at (23.6, 5.8, -327). The exports have been re-laid-out since that
   doc was written. The camera therefore frames from the floor's computed
   bounds, never from a hardcoded origin.
2. **Displacement is GPU-only.** three.js does not recompute normals after
   displacement (the normal map carries the shading, as `floor.json` intends)
   and the CPU never sees displaced heights. Fine now because pieces have
   baked positions; pins in a later milestone will need the height PNG sampled
   on the CPU.
3. **Normal map orientation.** `floor.json` requires `flipY = false` with
   `normalScale = (1, -1)`; getting either wrong inverts the shading.
4. **Memory/perf.** A 4096 base colour plus a 512x870 displaced mesh is heavy
   for kiosk hardware. Not optimised in this milestone; measure first.
5. **Pre-existing doc drift.** The parent spec still calls texturing
   "unresolved" while `floor.json` documents a finished textured floor. Not
   edited here.

## Verification

No automated tests (parent spec: none for v1; this milestone is visual). Run
the dev server and use the built-in browser to confirm:

- No console errors; the loader appears and then clears.
- Terrain shading is consistent with `floor.json`'s description (not inverted)
  and the displaced relief reads correctly.
- All six piece files render, seated on the terrain (no floating or buried
  pieces) at their expected locations.
- Orbit, pan, zoom and WASD all stay inside the clamped bounds; the board edge
  and sky never show an unintended void at the default framing.
- `npm run build` succeeds and the built output loads from `vite preview`.
