# Flags and blocks (removed 2026-10-09)

The glowing flags, the formations of bars (blocks) that stood for each unit, their name chips and the pure maths behind them
were taken out of the scene on the author's instruction ("remove the blocks", "remove flags"): the units are now the soldier
and cannon statues themselves (`src/scene/TroopStatues.tsx`, `Cannons.tsx`).

They were never committed to git, so these copies are the only ones. They are kept here, renamed to `.txt` so that neither TypeScript nor Vitest picks them up, in case they are wanted back:
drop the `.txt`, put them in `src/scene/`, and mount `<Flag unit marches board />` for each unit in `March.tsx`. `Flag.tsx` here is the
slim version (flag only) from the same day; the bars version lived in `formation.ts` / `formationGeometry.ts` / `unitLabel.ts`.

**Restored 2026-10-12** for `?props=flat`: `formation.ts`, `formationGeometry.ts`, `unitLabel.ts`, `flagCloth.ts` (with their tests) and `formation.css` are back in `src/scene/` and `src/ui/` (these copies stay as the record). The component that drew the bars (`src/scene/Force.tsx`) was not archived (only its later flag-only version was); it was rebuilt from the minified 2026-10-09 build in `app/dist`.
