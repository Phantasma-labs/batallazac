import { Euler, Quaternion, Vector3 } from 'three'
import type { Vec3 } from './math'

/** Depth of field of a hand-placed shot: the distance that is sharp, the blur size (px of the effect's half-size buffer, 0 = off) and the depth, in world units, that stays sharp around it. */
export type ShotDof = { focusDistance: number; blur: number; range: number }

/**
 * A camera placed by hand: where it stands (world units), where it looks (compass heading in degrees, 0 = north, 90 = east;
 * pitch in degrees below the horizon; roll about the lens axis) and its lens (vertical field of view, degrees).
 */
export type ManualShot = { position: Vec3; yawDeg: number; pitchDeg: number; rollDeg: number; fovDeg: number; dof: ShotDof }

/** The points of the day that get a hand-placed camera. Before the first placed one the camera is on the wide shot. */
export const SHOT_KEYS = ['10:00', '11:00', '11:30', '12:00', '13:00', '16:00', '17:00', '18:00', '19:00'] as const
export type ShotKey = (typeof SHOT_KEYS)[number]
/** Minutes after midnight (clock minutes, as `clock.time`). */
export const SHOT_MINUTES: Record<ShotKey, number> = { '10:00': 600, '11:00': 660, '11:30': 690, '12:00': 720, '13:00': 780, '16:00': 960, '17:00': 1020, '18:00': 1080, '19:00': 1140 }

export type Shots = Partial<Record<ShotKey, ManualShot>>

/**
 * The cameras the author placed by hand with the dev panel (its "Copy JSON"), second pass 2026-10-11, judged in a 1468 x 727
 * window (aspect 2.019; the first pass was at 1024 x 600): the lens is the vertical field of view, so a squarer window shows
 * less of the sides of these frames. A time with no shot holds the previous one, and the camera starts on the wide shot.
 * The depth of field is on in all of them (blur 1 to 8.4).
 */
// 2026-10-13: Cerro de Loreto at 11:00 (the author's wide shot), La Sierpe by 11:30 and held to 12:00, then a glide 240 units south to Cerro del Grillo (Natera's army in view) from 12:00 to 13:00, held to 16:00.
// An earlier, wider shot for 12:30 to 16:00: { position: { x: -491, y: 1529, z: 946.02 }, yawDeg: 0, pitchDeg: 61.28, rollDeg: 0, fovDeg: 10.9, dof: { focusDistance: 1742.75, blur: 1, range: 167 } }.
export const MANUAL_SHOTS: Shots = {
  '10:00': { position: { x: 329, y: 2199, z: 946.02 }, yawDeg: 0, pitchDeg: 61.3, rollDeg: 0, fovDeg: 6.72, dof: { focusDistance: 2506.25, blur: 7.2, range: 157 } },
  '11:00': { position: { x: 0, y: 1908, z: 946.02 }, yawDeg: 0, pitchDeg: 61.28, rollDeg: 0, fovDeg: 11.98, dof: { focusDistance: 2174.91, blur: 1.9, range: 206 } },
  '11:30': { position: { x: -471, y: 1875, z: 946.02 }, yawDeg: 0, pitchDeg: 61.28, rollDeg: 0, fovDeg: 7.61, dof: { focusDistance: 2070, blur: 8.4, range: 226 } },
  '12:00': { position: { x: -471, y: 1875, z: 946.02 }, yawDeg: 0, pitchDeg: 61.28, rollDeg: 0, fovDeg: 7.61, dof: { focusDistance: 2070, blur: 8.4, range: 226 } },
  '13:00': { position: { x: -471, y: 1875, z: 1186.02 }, yawDeg: 0, pitchDeg: 61.28, rollDeg: 0, fovDeg: 7.61, dof: { focusDistance: 2070, blur: 8.4, range: 226 } },
  '16:00': { position: { x: -471, y: 1875, z: 1186.02 }, yawDeg: 0, pitchDeg: 61.28, rollDeg: 0, fovDeg: 7.61, dof: { focusDistance: 2070, blur: 8.4, range: 226 } },
  '17:00': { position: { x: -27, y: 1563, z: 946.02 }, yawDeg: 0, pitchDeg: 61.28, rollDeg: 0, fovDeg: 12.97, dof: { focusDistance: 1781.52, blur: 1, range: 167 } },
  '18:00': { position: { x: 66, y: 1662, z: 946.02 }, yawDeg: 0, pitchDeg: 61.28, rollDeg: 0, fovDeg: 16.47, dof: { focusDistance: 1894.4, blur: 1, range: 245 } },
  '19:00': { position: { x: 323, y: 1722, z: 946.02 }, yawDeg: 0, pitchDeg: 61.28, rollDeg: 0, fovDeg: 11.5, dof: { focusDistance: 1962.82, blur: 1, range: 216 } },
}

const rad = (deg: number) => (deg * Math.PI) / 180
const deg = (r: number) => (r * 180) / Math.PI
const euler = new Euler()

/** Orientation for a heading, a pitch below the horizon and a roll (the roll is applied last, about the lens axis, like `aimQuaternion`). Fills `out` when given. */
export function poseQuaternion(yawDeg: number, pitchDeg: number, rollDeg: number, out = new Quaternion()): Quaternion {
  return out.setFromEuler(euler.set(-rad(pitchDeg), -rad(yawDeg), rad(rollDeg), 'YXZ'))
}

/** The heading, pitch and roll of an orientation (the inverse of `poseQuaternion`, pitch within +-90). */
export function poseAngles(q: Quaternion): { yawDeg: number; pitchDeg: number; rollDeg: number } {
  euler.setFromQuaternion(q, 'YXZ')
  return { yawDeg: -deg(euler.y) + 0, pitchDeg: -deg(euler.x) + 0, rollDeg: deg(euler.z) + 0 }
}

const tanHalf = (fovDeg: number) => Math.tan(rad(fovDeg) / 2)

/** How many times bigger things look than in the wide shot (the ratio of the half-frame tangents, which is what the picture does). */
export const zoomOf = (wideFov: number, fovDeg: number) => tanHalf(wideFov) / tanHalf(fovDeg)
export const fovFromZoom = (wideFov: number, zoom: number) => deg(2 * Math.atan(tanHalf(wideFov) / zoom))

/** Height of a full-frame sensor, mm: the lens is quoted as the focal length that gives this vertical field of view on it. */
const SENSOR_HEIGHT_MM = 24
export const focalLengthMm = (fovDeg: number) => SENSOR_HEIGHT_MM / 2 / tanHalf(fovDeg)
export const fovFromFocalLength = (mm: number) => deg(2 * Math.atan(SENSOR_HEIGHT_MM / 2 / mm))

/** What the camera follows: the wide shot, one shot held while it is edited, or the keyframes (the shots through the day, see `track.ts`). */
export type CameraSource = { kind: 'wide' } | { kind: 'edit'; key: ShotKey } | { kind: 'track' }

const WIDE: CameraSource = { kind: 'wide' }
const TRACK: CameraSource = { kind: 'track' }

/**
 * Where the camera should be: on the shot being edited, otherwise (while the director has the camera and a shot is placed) flowing
 * through the keyframes with the clock, otherwise on the wide shot (an edited key that is not placed yet is wide too).
 */
export function cameraSource(shots: Shots, editing: ShotKey | null, directorOn: boolean): CameraSource {
  if (editing) return shots[editing] ? { kind: 'edit', key: editing } : WIDE
  return directorOn && SHOT_KEYS.some((k) => shots[k]) ? TRACK : WIDE
}

const forward = new Vector3()

/** Distance along the lens axis to the horizontal plane `groundY`, or null if the lens looks at or above the horizon. */
export function centreFocusDistance(position: Vec3, q: Quaternion, groundY: number): number | null {
  forward.set(0, 0, -1).applyQuaternion(q)
  if (forward.y > -1e-6) return null
  return (groundY - position.y) / forward.y
}

const round = (n: number) => +n.toFixed(2)

/** The text "Copy JSON" gives: the placed shots by time, rounded, with the window shape they were judged in. */
export function shotsToJson(shots: Shots, view: { width: number; height: number }): string {
  const out: Record<string, ManualShot> = {}
  for (const key of SHOT_KEYS) {
    const s = shots[key]
    if (!s) continue
    out[key] = {
      position: { x: round(s.position.x), y: round(s.position.y), z: round(s.position.z) },
      yawDeg: round(s.yawDeg),
      pitchDeg: round(s.pitchDeg),
      rollDeg: round(s.rollDeg),
      fovDeg: round(s.fovDeg),
      dof: { focusDistance: round(s.dof.focusDistance), blur: round(s.dof.blur), range: round(s.dof.range) },
    }
  }
  return JSON.stringify({ window: { width: view.width, height: view.height, aspect: +(view.width / view.height).toFixed(3) }, shots: out }, null, 2)
}

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

function asShot(v: unknown): ManualShot | null {
  const s = v as Partial<ManualShot> | null
  if (!s || typeof s !== 'object' || !s.position || !s.dof) return null
  const { position: p, dof: d } = s
  if (![p.x, p.y, p.z, s.yawDeg, s.pitchDeg, s.rollDeg, s.fovDeg, d.focusDistance, d.blur, d.range].every(finite)) return null
  return {
    position: { x: p.x, y: p.y, z: p.z },
    yawDeg: s.yawDeg!,
    pitchDeg: s.pitchDeg!,
    rollDeg: s.rollDeg!,
    fovDeg: s.fovDeg!,
    dof: { focusDistance: d.focusDistance, blur: d.blur, range: d.range },
  }
}

/** Reads shots back from `shotsToJson` text (or a saved draft). Anything malformed, or with a time that is not a shot time, is dropped. */
export function parseShots(text: string | null): Shots {
  if (!text) return {}
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return {}
  }
  const table = (raw as { shots?: Record<string, unknown> } | null)?.shots
  const out: Shots = {}
  if (!table || typeof table !== 'object') return out
  for (const key of SHOT_KEYS) {
    const s = asShot(table[key])
    if (s) out[key] = s
  }
  return out
}
