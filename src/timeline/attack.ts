import type { Vec3 } from '../camera/math'

/** An arrow shorter than this (world units) reads as a dot, so a unit standing on its target gets a longer one. */
export const MIN_ARROW = 70

/**
 * The line an attack arrow follows, from `from` (the attacker) to `target`. When the attacker stands on or near its
 * target (Villa's column has marched up onto El Grillo), the arrow starts MIN_ARROW back along the way it came, from
 * `approach` (where its last march began), so the assault is seen coming from a direction.
 */
export function attackLine(from: Vec3, target: Vec3, approach?: Vec3, min = MIN_ARROW): { from: Vec3; to: Vec3 } {
  const d = Math.hypot(target.x - from.x, target.z - from.z)
  if (d >= min) return { from: { ...from }, to: { ...target } }
  const a = approach ?? { x: target.x - min, y: target.y, z: target.z }
  let dx = a.x - target.x, dz = a.z - target.z
  const l = Math.hypot(dx, dz)
  if (l < 1e-6) {
    dx = -1
    dz = 0
  } else {
    dx /= l
    dz /= l
  }
  return { from: { x: target.x + dx * min, y: target.y, z: target.z + dz * min }, to: { ...target } }
}
