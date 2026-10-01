# La Toma de Zacatecas: map app

Interactive 3D map of the 1914 Battle of Zacatecas (React + three.js). Design and plans live in `docs/superpowers/`.

## Run

```bash
npm install
npm run sync-assets   # copies ../Blender/Exports + the Draco decoder into public/
npm run dev           # http://localhost:5173
```

Controls: left-drag pan, right-drag orbit, scroll zoom, WASD / arrow keys pan.

## Updating meshes from Blender

The models in `public/` are copies. After re-exporting from Blender (floor, pieces, or both):

```bash
npm run sync-assets
```

and reload. No code changes are needed as long as the files keep their names (`floor_baked.glb`,
`cathedral.glb`, ...). The list of models the app shows is `src/scene/assets.json`: to add a piece, export its
`.glb` to `Blender/Exports/meshes/` and add one line there; if you rename a file in Blender, update its name
there. `sync-assets` checks the two against each other and tells you about a missing, renamed, unused,
empty or half-written model, and leaves the previous working copy untouched when it refuses to sync.
Set `EXPORTS_DIR` to sync from somewhere other than `../Blender/Exports`.
The floor is regenerated with `Blender/heightmaps/bake_floor_mesh.py`.

## Deploy (kiosk or any static host)

```bash
npm run sync-assets   # after every Blender re-export
npm run build         # public/ is copied into dist/ at build time, so rebuild after each sync
```

Serve `dist/` with any static web server. There is no backend, but browsers do not allow opening
`dist/index.html` straight from disk (`file://`): module scripts and model fetches are blocked, and the page
stays blank. For a quick local check use `npm run preview`.

## Scripts

`npm test` (syncs, then runs unit tests) · `npm run typecheck` · `npm run build` · `npm run preview`
