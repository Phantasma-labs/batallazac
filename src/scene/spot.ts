import type { Bounds, Vec3 } from '../camera/math'

/** How high the light hangs, as a multiple of the board's width: the same falloff on any board. */
const HEIGHT_PER_WIDTH = 1.15
/** The cone's half-angle as a multiple of the angle to the farthest corner: above 1 keeps every corner inside the cone. */
const CONE_OVER_CORNER = 1.02
/** The widest cone three.js handles well (it is a half-angle, up to 90 degrees). */
const MAX_ANGLE = Math.PI / 2 - 0.05
/** 1 = the light eases off all the way from the axis to the rim of the cone (no hard edge). */
export const SPOT_PENUMBRA = 1

/** Slack, in world units, kept around the board in the shadow camera's depth range. */
const SHADOW_MARGIN = 150
/** The shadow camera's field of view is the tightest that holds the board, times this (a little slack at the edges). */
const SHADOW_FIT = 1.03
/**
 * How high the light stands above the horizon, seen from the middle of the pool (the light is a point, so the
 * angle is a little steeper in the north of the board and shallower in the south). Lower = longer shadows.
 */
export const SPOT_ELEVATION_DEG = 60
/**
 * How far the light leans toward the north from straight above, in degrees (it stays aimed at the middle of the
 * pool). Straight above, a statue's shadow is a few units long and hidden behind it; leaning north throws the
 * shadows toward the viewer, who looks from the south.
 */
export const SPOT_TILT_DEG = 90 - SPOT_ELEVATION_DEG

export type SpotRig = {
  position: Vec3
  target: Vec3
  angle: number
  penumbra: number
  /** Shadow camera depth range (distances along the light's axis): tight around the board, for depth precision on small statues. */
  near: number
  far: number
  /**
   * Shrinks the shadow camera's field of view (three's `shadow.focus`, 0..1) to just hold the board, so the shadow map's
   * texels all land on the board instead of on the empty corners of the light's wide cone: sharper shadows.
   */
  shadowFocus: number
}

const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z })
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z
const cross = (a: Vec3, b: Vec3): Vec3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x })

/**
 * A spot light hanging above `focus` (default: the middle of `b`), leaning `tiltDeg` toward the north and aimed
 * at `focus`, with a cone wide enough to take in the board's far top corners and a fully soft edge: brightest
 * at the focus, easing off toward the corners. Aim it at the middle of the ground the screen shows and the fade
 * is even all round the frame.
 */
export function spotRig(b: Bounds, focus?: { x: number; z: number }, tiltDeg: number = SPOT_TILT_DEG): SpotRig {
  const cx = focus?.x ?? (b.minX + b.maxX) / 2
  const cz = focus?.z ?? (b.minZ + b.maxZ) / 2
  const height = HEIGHT_PER_WIDTH * (b.maxX - b.minX)
  const position = { x: cx, y: b.minY + height, z: cz - height * Math.tan((tiltDeg * Math.PI) / 180) }
  const target = { x: cx, y: b.minY, z: cz }
  const axis = sub(target, position)
  const axisLen = Math.hypot(axis.x, axis.y, axis.z)

  // Angle off the axis of the two far (north) corners: what the opening view has at the top of the screen.
  const offAxis = (p: Vec3) => {
    const to = sub(p, position)
    return Math.acos(dot(axis, to) / (axisLen * Math.hypot(to.x, to.y, to.z)))
  }
  const farCorners = Math.max(offAxis({ x: b.minX, y: b.minY, z: b.minZ }), offAxis({ x: b.maxX, y: b.minY, z: b.minZ }))

  // The shadow camera looks along the axis with the world's up as its up: `right` and `up` are its image axes.
  const forward = { x: axis.x / axisLen, y: axis.y / axisLen, z: axis.z / axisLen }
  const rightLen = Math.hypot(forward.x, forward.z) // |forward x world-up|
  const right = rightLen > 1e-6 ? { x: -forward.z / rightLen, y: 0, z: forward.x / rightLen } : { x: 1, y: 0, z: 0 }
  const up = cross(right, forward)

  // Distances along the axis to the board's extreme points (corners at the lowest and the highest height), and how
  // far off the axis, sideways or up, the widest of them lies as seen from the light.
  let nearest = Infinity
  let farthest = -Infinity
  let widest = 0
  for (const x of [b.minX, b.maxX]) {
    for (const y of [b.minY, b.maxY]) {
      for (const z of [b.minZ, b.maxZ]) {
        const to = sub({ x, y, z }, position)
        const d = dot(to, forward)
        nearest = Math.min(nearest, d)
        farthest = Math.max(farthest, d)
        widest = Math.max(widest, Math.atan(Math.max(Math.abs(dot(to, right)), Math.abs(dot(to, up))) / d))
      }
    }
  }

  const angle = Math.min(farCorners * CONE_OVER_CORNER, MAX_ANGLE)
  return {
    position,
    target,
    angle,
    penumbra: SPOT_PENUMBRA,
    near: Math.max(1, nearest - SHADOW_MARGIN),
    far: farthest + SHADOW_MARGIN,
    shadowFocus: Math.min(1, (widest * SHADOW_FIT) / angle),
  }
}
