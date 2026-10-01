import type { Box3 } from 'three'

export type Vec3 = { x: number; y: number; z: number }
export type Bounds = { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number }

/** 50 mm lens on a 36 mm sensor, 16:9 frame: 2 * atan(10.125 / 50) = 22.9 degrees vertical. */
export const VFOV_DEG = 23
/** Default view is this many degrees away from looking straight down (the Blender diorama camera). */
export const TILT_DEG = 29
export const MIN_POLAR_DEG = 10
export const MAX_POLAR_DEG = 70
export const MIN_DISTANCE = 60
export const MAX_DISTANCE = 4000
/** Keyboard pan speed as a fraction of the camera's distance per second. */
export const PAN_SPEED = 0.6

const rad = (deg: number) => (deg * Math.PI) / 180
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi)

export function boundsFromBox(box: Box3): Bounds {
  return { minX: box.min.x, maxX: box.max.x, minY: box.min.y, maxY: box.max.y, minZ: box.min.z, maxZ: box.max.z }
}

export function clampTarget(t: Vec3, b: Bounds): Vec3 {
  return { x: clamp(t.x, b.minX, b.maxX), y: clamp(t.y, b.minY, b.maxY), z: clamp(t.z, b.minZ, b.maxZ) }
}

/** Distance at which the board's width fills the horizontal field of view. */
export function fitDistance(b: Bounds, vfovDeg: number, aspect: number): number {
  const halfH = Math.atan(Math.tan(rad(vfovDeg) / 2) * aspect)
  const d = (b.maxX - b.minX) / 2 / Math.tan(halfH)
  return clamp(d, MIN_DISTANCE, MAX_DISTANCE)
}

/** Camera south of the board centre (+z), TILT_DEG away from straight down, looking at the centre. */
export function defaultFraming(b: Bounds, distance: number): { target: Vec3; position: Vec3 } {
  const target = { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2, z: (b.minZ + b.maxZ) / 2 }
  const tilt = rad(TILT_DEG)
  return {
    target,
    position: { x: target.x, y: target.y + distance * Math.cos(tilt), z: target.z + distance * Math.sin(tilt) },
  }
}

/**
 * Ground-plane movement for the held keys. `keys` holds lowercased KeyboardEvent.key values;
 * `forward` is the camera heading projected on the ground (x, z). Right is forward rotated so
 * that facing -z gives +x (east).
 */
export function panVector(
  keys: ReadonlySet<string>,
  forward: { x: number; z: number },
  distance: number,
  dt: number,
): { x: number; z: number } {
  const ahead = (keys.has('w') || keys.has('arrowup') ? 1 : 0) - (keys.has('s') || keys.has('arrowdown') ? 1 : 0)
  const side = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0)
  const len = Math.hypot(forward.x, forward.z)
  if ((!ahead && !side) || len < 1e-9) return { x: 0, z: 0 }
  const fx = forward.x / len, fz = forward.z / len
  const rx = -fz, rz = fx
  const norm = Math.hypot(ahead, side) // diagonals are not faster
  const mag = (PAN_SPEED * distance * dt) / norm
  return { x: (fx * ahead + rx * side) * mag, z: (fz * ahead + rz * side) * mag }
}
