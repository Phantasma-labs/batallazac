import type { Box3 } from 'three'

export type Vec3 = { x: number; y: number; z: number }
export type Bounds = {
  minX: number
  maxX: number
  minY: number
  maxY: number
  minZ: number
  maxZ: number
  /** Height of the board's outer rim, when measured. The rim is far below the hills (`maxY`), and it is the line that has to meet the screen edge. */
  rimY?: number
}

/** 50 mm lens on a 36 mm sensor, 16:9 frame: 2 * atan(10.125 / 50) = 22.9 degrees vertical. */
export const VFOV_DEG = 23
/** Default view is this many degrees away from looking straight down (the Blender diorama camera). */
export const TILT_DEG = 29
export const MIN_POLAR_DEG = 10
export const MAX_POLAR_DEG = 70
export const MIN_DISTANCE = 60
export const MAX_DISTANCE = 4000
/** Camera stays this far above the highest terrain point so it can never enter the geometry. */
export const CAMERA_CLEARANCE = 2
/** The narrowest window aspect the zoom cap still guarantees a full-width view for (a phone in portrait). */
const NARROWEST_ASPECT = 0.4
/** Keyboard pan speed as a fraction of the camera's distance per second. */
export const PAN_SPEED = 0.6
/** Longest frame time (s) a camera moves by: a tab coming back from the background must not teleport it. */
export const MAX_FRAME_DT = 0.1
/** Fraction of the half-frame kept clear around anything that must stay in the opening view. */
export const FRAMING_MARGIN = 0.04

const rad = (deg: number) => (deg * Math.PI) / 180
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi)

export function boundsFromBox(box: Box3): Bounds {
  // An empty Box3 has min=+Infinity / max=-Infinity, which would turn every framing value into NaN.
  if (box.isEmpty() || ![box.min.x, box.min.y, box.min.z, box.max.x, box.max.y, box.max.z].every(Number.isFinite)) {
    throw new Error('bounding box is empty: the model has no geometry')
  }
  return { minX: box.min.x, maxX: box.max.x, minY: box.min.y, maxY: box.max.y, minZ: box.min.z, maxZ: box.max.z }
}

/** Height of the board's outer rim: the measured one, or the lowest point of the floor when none was measured. */
export function rimOf(b: Bounds): number {
  return b.rimY ?? b.minY
}

/**
 * Height of the lowest point on the board's outer edge, from a flat array of world-space x, y, z values.
 * The edge is where the board ends and the empty background begins, so this is the height the framing must
 * line up with the screen edge (the hills in the middle are far higher and would hide a gap along the rim).
 * Falls back to the lowest point of the board when no vertex sits within `tol` of an edge.
 */
export function lowestRimY(xyz: ArrayLike<number>, b: Bounds, tol = 0.5): number {
  let lowest = Infinity
  for (let i = 0; i + 2 < xyz.length; i += 3) {
    const x = xyz[i], y = xyz[i + 1], z = xyz[i + 2]
    const onEdge = x <= b.minX + tol || x >= b.maxX - tol || z <= b.minZ + tol || z >= b.maxZ - tol
    if (onEdge && y < lowest) lowest = y
  }
  return Number.isFinite(lowest) ? lowest : b.minY
}

/** The board without its east part: the east edge moves in by this fraction of the width. */
export function cropEast(b: Bounds, fraction: number): Bounds {
  return { ...b, maxX: b.maxX - fraction * (b.maxX - b.minX) }
}

/** Corners of a box with its footprint (x and z) pulled in by this fraction of each side; heights unchanged. */
export function insetCorners(box: Box3, fraction: number): Vec3[] {
  const dx = (box.max.x - box.min.x) * fraction
  const dz = (box.max.z - box.min.z) * fraction
  return cornersOf(box).map((p) => ({
    x: p.x + (p.x === box.min.x ? dx : -dx),
    y: p.y,
    z: p.z + (p.z === box.min.z ? dz : -dz),
  }))
}

export function clampTarget(t: Vec3, b: Bounds): Vec3 {
  return { x: clamp(t.x, b.minX, b.maxX), y: clamp(t.y, b.minY, b.maxY), z: clamp(t.z, b.minZ, b.maxZ) }
}

/** Distance at which a board of this width fills the horizontal field of view, before any clamping. */
function rawFitDistance(width: number, vfovDeg: number, aspect: number): number {
  const halfH = Math.atan(Math.tan(rad(vfovDeg) / 2) * aspect)
  return width / 2 / Math.tan(halfH)
}

/**
 * Farthest the user may zoom out. Scales with the loaded board so a wider re-done floor can still be
 * seen whole in a narrow window; never less than MAX_DISTANCE.
 */
export function maxDistanceFor(b: Bounds): number {
  return Math.max(MAX_DISTANCE, 1.2 * rawFitDistance(b.maxX - b.minX, VFOV_DEG, NARROWEST_ASPECT))
}

/** The 8 corners of a box. */
export function cornersOf(box: Box3): Vec3[] {
  const { min, max } = box
  const out: Vec3[] = []
  for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) out.push({ x, y, z })
  return out
}

/**
 * Where a world point sits for a camera on the default tilt line looking at `target`: `x` to the right,
 * `up` up the screen, `along` toward the camera. A camera at distance d has the point at depth d - along.
 */
export function viewFrame(target: Vec3, p: Vec3): { x: number; up: number; along: number } {
  const tilt = rad(TILT_DEG)
  const qx = p.x - target.x, qy = p.y - target.y, qz = p.z - target.z
  return { x: qx, up: qy * Math.sin(tilt) - qz * Math.cos(tilt), along: qy * Math.cos(tilt) + qz * Math.sin(tilt) }
}

/**
 * Smallest distance on the default tilt line at which every point is inside the frame, keeping `margin`
 * (a fraction of the half-frame) clear at the edges. Depth is linear in distance, so this is closed-form.
 */
export function coverDistance(target: Vec3, points: readonly Vec3[], vfovDeg: number, aspect: number, margin: number): number {
  const ky = Math.tan(rad(vfovDeg) / 2) * (1 - margin)
  const kx = ky * aspect
  let d = 0
  for (const p of points) {
    const f = viewFrame(target, p)
    d = Math.max(d, f.along + Math.abs(f.x) / kx, f.along + Math.abs(f.up) / ky)
  }
  return d
}

/**
 * Where the view lands on the ground plane through its target, for a camera on the default tilt line at
 * UNIT distance (everything scales with the real distance). `xTop`/`zTop` is the far (north) edge, which is
 * wider than the near one: the view is a trapezoid, so fitting the board's width at the centre line leaves
 * empty corners at the top.
 */
export function viewFootprint(vfovDeg: number, aspect: number): { xTop: number; zTop: number; xBottom: number; zBottom: number } {
  const t = rad(TILT_DEG)
  const tv = Math.tan(rad(vfovDeg) / 2)
  const edge = (sy: number) => {
    const lambda = Math.cos(t) / (Math.cos(t) - sy * tv * Math.sin(t))
    return { x: lambda * tv * aspect, z: Math.sin(t) + lambda * (-Math.sin(t) - sy * tv * Math.cos(t)) }
  }
  const top = edge(1), bottom = edge(-1)
  return { xTop: top.x, zTop: top.z, xBottom: bottom.x, zBottom: bottom.z }
}

/**
 * Distance at which the far edge of the view is as wide as the board, so the view fills with board instead
 * of empty corners, within the zoom range. Anything in `mustSee` (e.g. the compass, which sits in a corner)
 * is pulled into the frame too.
 */
export function fitDistance(b: Bounds, vfovDeg: number, aspect: number, mustSee: readonly Vec3[] = []): number {
  const covered = coverDistance(defaultFraming(b, 1).target, mustSee, vfovDeg, aspect, FRAMING_MARGIN)
  const inside = (b.maxX - b.minX) / 2 / viewFootprint(vfovDeg, aspect).xTop
  return clamp(Math.max(inside, covered), MIN_DISTANCE, maxDistanceFor(b))
}

/**
 * The opening view: at the distance `fitDistance` gives, with the aim slid south until the board's north
 * edge reaches the top of the frame (or the `mustSee` points reach their margin, whichever comes first), but
 * never so far that the south edge comes into view, and never north. Camera on the default tilt line.
 */
export function openingFraming(
  b: Bounds,
  vfovDeg: number,
  aspect: number,
  mustSee: readonly Vec3[] = [],
): { target: Vec3; position: Vec3; distance: number } {
  const centre = defaultFraming(b, 1).target
  const distance = fitDistance(b, vfovDeg, aspect, mustSee)
  const t = rad(TILT_DEG)
  const tv = Math.tan(rad(vfovDeg) / 2)
  // How far south the aim may move before `p` leaves the frame at clearance k (a fraction of the half-frame).
  const room = (p: Vec3, k: number) => {
    const f = viewFrame(centre, p)
    return (k * (distance - f.along) - f.up) / (Math.cos(t) - k * Math.sin(t))
  }
  let slide = room({ x: centre.x, y: b.maxY, z: b.minZ }, tv) // north edge of the board at the very top of the frame
  for (const p of mustSee) slide = Math.min(slide, room(p, tv * (1 - FRAMING_MARGIN)))
  slide = Math.min(slide, b.maxZ - (centre.z + distance * viewFootprint(vfovDeg, aspect).zBottom)) // keep the south edge out
  const target = { x: centre.x, y: centre.y, z: centre.z + Math.max(0, slide) }
  return {
    target,
    distance,
    position: { x: target.x, y: target.y + distance * Math.cos(t), z: target.z + distance * Math.sin(t) },
  }
}

/** Lowest camera height: above the highest terrain point, whatever floor was loaded. */
export function clampCameraHeight(y: number, b: Bounds): number {
  return Math.max(y, b.maxY + CAMERA_CLEARANCE)
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
