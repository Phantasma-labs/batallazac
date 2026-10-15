import { DEPTH_OF_FIELD } from '../scene/macro'

/**
 * What the tripod lens is doing right now, written by `LockedCamera` every frame and read by the post-processing
 * (`PostFx`), which needs to know how far in the lens is and what is in focus but not about hotspots.
 */
export const shot = {
  /** The lens now, and the lens of the wide shot, in degrees (0 until the camera has been set up). */
  fov: 0,
  wideFov: 0,
  /** Distance from the camera to what the lens is aimed at, in world units. */
  focusDistance: 1000,
  /** Depth of field now: the blur size (0 = off) and the depth, in world units, that stays sharp around the focus. */
  blur: 0,
  range: DEPTH_OF_FIELD.focusRange,
}
