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
`cathedral.glb`, ...). To add a new piece, drop its `.glb` in `Blender/Exports/meshes/` and add one line to
`src/scene/sceneAssets.ts`. Set `EXPORTS_DIR` to sync from somewhere other than `../Blender/Exports`.
The floor is regenerated with `Blender/heightmaps/bake_floor_mesh.py`.

## Scripts

`npm test` (syncs, then runs unit tests) · `npm run typecheck` · `npm run build` · `npm run preview`
