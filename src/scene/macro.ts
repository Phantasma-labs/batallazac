/**
 * The macro look: when the lens zooms in on a statue the picture should read like a close-up of a miniature,
 * with a shallow depth of field and a heavier vignette. Pure maths; `PostFx.tsx` applies it.
 */

/** Zoom (wide fov / current fov) below which the shot is still "wide": no depth of field at all. */
const START_ZOOM = 1.15
/** Zoom from which the look is complete (a hotspot lens is about 3x the wide shot). */
const FULL_ZOOM = 2.2

/**
 * Vignette strength (the "eskil" technique: the multiplier is a steep smoothstep of the distance from the centre, so
 * the number is not linear; the figures below are the mean darkening over the frame). `wide` is the overall vignette,
 * `macro` the one in a close-up. History: wide 0.38 (4.8%) -> 0.48 (9.7%, user: 2x) -> 0.628 (19.4%, user: "2x darker");
 * macro 0.85 (37%) -> 1.1 (54%) -> 0.395 (5.5%, user: "subtle, 1/10 of what it is now"), so a close-up is now lighter
 * than the wide shot.
 */
export const VIGNETTE = { wide: 0.628, macro: 0.395, offset: 0.3 }
/** Depth of field: blur size in pixels of the effect's half-size buffer, and the depth, in world units, that stays sharp. */
export const DEPTH_OF_FIELD = { bokehScale: 10, focusRange: 100 }

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const smoothstep = (t: number) => t * t * (3 - 2 * t)

/** 0 in the wide shot, 1 once the lens has zoomed well in, eased in between (it follows the zoom, so it animates with it). */
export function macroAmount(wideFov: number, fov: number): number {
  if (!(wideFov > 0) || !(fov > 0)) return 0
  return smoothstep(clamp01((wideFov / fov - START_ZOOM) / (FULL_ZOOM - START_ZOOM)))
}

export type MacroLook = { bokehScale: number; focusRange: number; vignette: number }

export function macroLook(amount: number): MacroLook {
  const a = clamp01(amount)
  return {
    bokehScale: DEPTH_OF_FIELD.bokehScale * a,
    focusRange: DEPTH_OF_FIELD.focusRange,
    vignette: VIGNETTE.wide + (VIGNETTE.macro - VIGNETTE.wide) * a,
  }
}
