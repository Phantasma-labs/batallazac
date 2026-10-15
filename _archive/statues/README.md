# Statues and props (retired 2026-10-14)

The 3D statues (Vetagrande cannons, villista and federal soldier groups, cathedral, sandbag emplacement, Villa's train) were
removed from the app: the units are the formations of bars (`src/scene/Force.tsx`) and the map has no 3D props.

- `models/*.glb`: the six statue GLBs, as they were in `public/models/`.
- `src/*.txt`: `Cannons`, `TroopStatues`, `troopModels`, `troopPose` (+ test), `ShadowSync`, `shadowDirty`, `props` (+ test: the old
  `?props=real` flag), `pieceMove` (+ test: the `moveTo` of the train). Rename without `.txt` and put them back in `src/scene/`.
- Things that were changed when they left: `GUN_MUZZLES` and the `Aim` type now live in `gunFire.ts` (they were in `Cannons.tsx` and
  `troopPose.ts`); `MapScene` drew `Cannons`, `TroopStatues` and `ShadowSync`; `assets.json` listed the six GLBs (`"heavy": true`;
  `sceneAssets.ts` had `PROPS_MODE`, `UNIT_BLOCKS`, `FETCHED_PIECES`); `Piece.tsx` took a `moveTo`.
