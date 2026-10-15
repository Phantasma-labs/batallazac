import type { ManualShot } from './manualShots'

/**
 * How the timeline director, the dev panel and the tripod camera meet without knowing each other. `LockedCamera` registers
 * `focus` (go to a shot by id, or back to the wide shot with null), `readPose` (where the camera is now, to start a hand-placed
 * shot from) and `centreDistance` (how far the thing at the middle of the frame is); the director calls `focus`. `directorOn`
 * is false after the viewer has taken the camera (Esc, a click on a hotspot, the panel's close button) until they play or scrub again.
 */
export const cameraBus: {
  focus: ((shotId: string | null) => void) | null
  readPose: (() => ManualShot) | null
  centreDistance: (() => number | null) | null
  directorOn: boolean
} = { focus: null, readPose: null, centreDistance: null, directorOn: true }
