/**
 * The floor's bump: a normal map made from the painted map (Blender/heightmaps/make_floor_normal.py), so the black
 * contours and hatching catch the light like slightly raised ink. The floor file declares its own normal map in its
 * scene extras (`normalMap`, a path relative to public/), so a floor without one (the old framed board, whose painting
 * has another layout) never gets a mismatched map.
 */

/**
 * How strong the bump is: multiplies the normal map (made at "full" strength 3). Measured on the cannons' zoom: 0.6 changes
 * the picture by about 1 level per pixel (barely visible), 1.5 by about 2.5 (clear, gentle), 3 by about 4.6 (the ink starts
 * to look embossed). Try it live with ?bump=1.2 or ?bump=off.
 */
export const DEFAULT_BUMP_SCALE = 1.5
const MAX_BUMP_SCALE = 3

/** The normal map the floor file asks for, or null. Anything that is not a non-empty string is ignored. */
export function floorNormalMapUrl(extras: unknown): string | null {
  const url = (extras as { normalMap?: unknown } | null | undefined)?.normalMap
  return typeof url === 'string' && url.trim() !== '' ? url.trim() : null
}

/** `?bump=off` (or 0) turns the bump off, `?bump=1.2` sets its strength; anything else is the default. */
export function bumpScaleFromSearch(search: string, fallback: number = DEFAULT_BUMP_SCALE): number {
  const v = new URLSearchParams(search).get('bump')
  if (v === null) return fallback
  if (v.toLowerCase() === 'off') return 0
  const n = Number(v)
  return v.trim() !== '' && Number.isFinite(n) && n >= 0 ? Math.min(n, MAX_BUMP_SCALE) : fallback
}
