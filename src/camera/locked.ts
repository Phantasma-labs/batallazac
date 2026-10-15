import { Matrix4, Quaternion, Sphere, Vector3, type Ray } from 'three'
import { VFOV_DEG, openingFraming, rimOf, type Bounds, type Vec3 } from './math'

/** The locked camera is placed for a window of this shape, whatever the real window is. */
export const REFERENCE_ASPECT = 16 / 9
/** Tightest lens (about 4x zoom from the wide shot). The painted floor is 4096 px across the board; tighter than this it softens. */
export const MIN_FOV_DEG = 6
/** Widest lens, for a very narrow window. */
export const MAX_FOV_DEG = 75
/** Seconds for the lens to zoom and the camera to turn from one shot to the next. */
export const FOCUS_SECONDS = 1.4

/** A place the user can click: where the lens aims, how much to frame, and how big the click target is. */
export type Hotspot = {
  id: string
  point: Vec3
  /** Radius (world units) of the area to fit in frame. */
  radius: number
  /** Radius of the invisible click sphere, generous because pieces are tiny in the wide shot. */
  hitRadius: number
  /** Slight camera roll in degrees for the focused shot. */
  rollDeg: number
}

/**
 * Hotspots are authored for the original board. A floor stretched `k` times wider has its pieces moved by the
 * same factor, and a hotspot whose hill was moved on the board (`shifts`, by id, in world units after the
 * stretch) follows it.
 */
export function stretchHotspots(hotspots: readonly Hotspot[], k: number, shifts: Readonly<Record<string, number>> = {}): Hotspot[] {
  return hotspots.map((h) => ({ ...h, point: { ...h.point, x: h.point.x * k + (shifts[h.id] ?? 0) } }))
}

/**
 * What the floor file says about how its board differs from the original: the stretch factor and the sideways
 * shifts of moved hotspots, from the glTF scene extras (written by Blender/heightmaps/export_wide_set.py).
 * Anything missing or malformed means an unchanged board.
 */
export function floorLayout(extras: unknown): { stretch: number; shifts: Record<string, number> } {
  const e = (extras ?? {}) as { stretchX?: unknown; hotspotShifts?: unknown }
  const k = Number(e.stretchX)
  const shifts: Record<string, number> = {}
  if (e.hotspotShifts && typeof e.hotspotShifts === 'object') {
    for (const [id, v] of Object.entries(e.hotspotShifts)) if (typeof v === 'number' && Number.isFinite(v)) shifts[id] = v
  }
  return { stretch: Number.isFinite(k) && k > 0 ? k : 1, shifts }
}

const rad = (deg: number) => (deg * Math.PI) / 180
const deg = (r: number) => (r * 180) / Math.PI
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi)

/** The one place the camera ever sits, and the point it looks at when the view is wide. */
export type LockedRig = { position: Vec3; target: Vec3; distance: number }

/** The free camera's opening view for a 16:9 window, whatever the real window is. */
export function lockedRig(b: Bounds, mustSee: readonly Vec3[] = []): LockedRig {
  const { position, target, distance } = openingFraming(b, VFOV_DEG, REFERENCE_ASPECT, mustSee)
  return { position, target, distance }
}

/**
 * Fraction of the board's width, from its east edge, that the opening view leaves out: the map is a big board and
 * the part of interest is the west and the middle. The tripod sits in the middle of what is kept, and the right
 * edge of the screen is the cut line (about x = 655 on the 1.679x board).
 */
export const EAST_CROP = 0.143

/** Fraction of the half-frame kept clear around what the wide shot must show. Small on purpose: the opening view is a tight crop. */
export const WIDE_MARGIN = 0.01

/** In a squarer window the far corners of the board may be cropped by at most this fraction of the half-width; past that the lens opens instead. */
const MAX_SIDE_CROP = 0.08

/** Where the lens looks (a point on the ground straight ahead of the camera) and its vertical field of view, in degrees. */
export type WideShot = { fov: number; target: Vec3 }

const tanHalf = (fovDeg: number) => Math.tan(rad(fovDeg) / 2)

/**
 * The wide shot for this window shape, from a camera that cannot move: the lens and the pitch do all the
 * fitting. The board's north edge goes exactly on the top edge of the screen, and the lens opens as far as it
 * can without letting an empty strip into view: wider would show background beside the far corners, or
 * beyond the south edge. In a squarer window that would crop the board hard at the sides, so the lens opens
 * to keep the far corners within MAX_SIDE_CROP of the screen edge (some background then shows below the board).
 * Anything in `mustSee` (the compass) is kept inside the frame, opening the lens
 * further than that (a squarer window then shows some background below the board) if it has to.
 *
 * Closed form, with the camera looking due north at pitch `theta` (angle below the horizon), `phi` the angle
 * below the horizon of the ray to a rim point, and `tv` = tan(vfov / 2). North edge on the top of the screen
 * means theta = phiN + atan(tv). The far corners then sit at ndc.x = dx * sqrt(1 + tv^2) / (rho * tv * aspect),
 * and the south edge is on the bottom of the screen when 2 * atan(tv) = phiS - phiN.
 */
export function wideShot(b: Bounds, position: Vec3, aspect: number, mustSee: readonly Vec3[] = []): WideShot {
  const rim = rimOf(b)
  const h = position.y - rim
  const ahead = (z: number) => position.z - z // how far north of the camera a point lies
  const phiN = Math.atan2(h, ahead(b.minZ))
  const phiS = Math.atan2(h, ahead(b.maxZ))
  const rhoN = Math.hypot(h, ahead(b.minZ))
  const dx = Math.max(Math.abs(b.minX - position.x), Math.abs(b.maxX - position.x))
  const tvMax = tanHalf(MAX_FOV_DEG)
  // Lens at which the far corners sit `crop` beyond the side of the screen (0 = exactly on the corner of the screen).
  const tvForCrop = (crop: number) => {
    const s = dx / (rhoN * aspect * (1 + crop))
    return s >= 1 ? tvMax : s / Math.sqrt(1 - s * s)
  }
  const tvSouth = Math.tan((phiS - phiN) / 2)

  let tv = Math.min(Math.max(Math.min(tvForCrop(0), tvSouth), tvForCrop(MAX_SIDE_CROP)), tvMax)
  const inside = (t: number) => {
    const theta = phiN + Math.atan(t)
    const sin = Math.sin(theta), cos = Math.cos(theta)
    return mustSee.every((p) => {
      const down = position.y - p.y, north = ahead(p.z)
      const depth = down * sin + north * cos
      if (depth <= 1e-6) return false
      const k = (1 - WIDE_MARGIN) * depth * t
      return Math.abs(-down * cos + north * sin) <= k && Math.abs(p.x - position.x) <= k * aspect
    })
  }
  if (!inside(tv)) {
    // Open the lens in small steps until everything is in, then refine. (Not a plain bisection: with the pitch
    // following the north edge, a fully open lens can look past the compass again.)
    let lo = tv, hi = tv
    while (hi < tvMax && !inside(hi)) {
      lo = hi
      hi = Math.min(hi * 1.05, tvMax)
    }
    if (inside(hi)) {
      for (let i = 0; i < 40; i++) {
        const mid = (lo + hi) / 2
        if (inside(mid)) hi = mid
        else lo = mid
      }
      tv = hi
    }
    // else: nothing the lens can do (a point on the north edge itself); keep the tight shot rather than open fully
  }

  const fov = tv >= tvMax ? MAX_FOV_DEG : Math.max(deg(2 * Math.atan(tv)), MIN_FOV_DEG)
  const theta = Math.min(phiN + Math.atan(tanHalf(fov)), Math.PI / 2 - 1e-3)
  return { fov, target: { x: position.x, y: rim, z: position.z - h / Math.tan(theta) } }
}

/**
 * Where the top (`far`) and the bottom (`near`) of the screen meet the ground plane at height `groundY`, as
 * world z, for a wide shot from `position`. The screen's vertical field of view is the angle between those rays.
 */
export function viewGroundZ(position: Vec3, shot: WideShot, groundY: number): { far: number; near: number } {
  const h = position.y - groundY
  const axis = Math.atan2(h, position.z - shot.target.z) // how far below the horizon the lens looks
  const half = rad(shot.fov) / 2
  const hit = (depression: number) => position.z - h / Math.tan(depression)
  return { far: hit(axis - half), near: hit(axis + half) }
}

/** Vertical field of view at which a sphere of this radius, this far away, fits the frame. */
export function fitFov(distance: number, radius: number, aspect: number): number {
  return deg(2 * Math.atan(radius / distance / Math.min(aspect, 1)))
}

/** The lens for a focused hotspot: fits its radius, but never tighter than MIN_FOV_DEG or wider than the wide shot. */
export function hotspotFov(position: Vec3, h: Hotspot, aspect: number, wide: number): number {
  const distance = Math.hypot(h.point.x - position.x, h.point.y - position.y, h.point.z - position.z)
  return clamp(fitFov(distance, h.radius, aspect), MIN_FOV_DEG, wide)
}

const lookMatrix = new Matrix4()
const eye = new Vector3()
const look = new Vector3()
const up = new Vector3(0, 1, 0)
const rollAxis = new Vector3(0, 0, 1)

/** Orientation of a camera at `position` looking at `target`, rolled `rollDeg` about the lens axis. */
export function aimQuaternion(position: Vec3, target: Vec3, rollDeg: number): Quaternion {
  lookMatrix.lookAt(eye.set(position.x, position.y, position.z), look.set(target.x, target.y, target.z), up)
  const q = new Quaternion().setFromRotationMatrix(lookMatrix)
  return q.multiply(new Quaternion().setFromAxisAngle(rollAxis, rad(rollDeg)))
}

/** World units kept between the corners of a focused frame and the board's edge. */
export const EDGE_MARGIN = 2

const ray = new Vector3()

/**
 * Where to aim a zoomed shot so that no background shows: `target`, moved over the ground just far enough that
 * the four corners of the frame (seen from `position` with this lens, aspect and roll) land on the board, at the rim
 * height, at least EDGE_MARGIN inside its edges. A shot that already fits is returned unchanged. The tripod cannot
 * move, so the lens turns instead: a hotspot near an edge (the cannons on the north rim) sits a little off-centre.
 * A corner ray that does not reach the ground (looking above the horizon) is ignored.
 */
export function keepOnBoard(position: Vec3, target: Vec3, rollDeg: number, fovDeg: number, aspect: number, b: Bounds, margin = EDGE_MARGIN): Vec3 {
  const rim = rimOf(b)
  const tv = tanHalf(fovDeg)
  const aim = { ...target }
  for (let i = 0; i < 40; i++) {
    const q = aimQuaternion(position, aim, rollDeg)
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        ray.set(sx * tv * aspect, sy * tv, -1).applyQuaternion(q)
        if (ray.y > -1e-6) continue
        const t = (rim - position.y) / ray.y
        const x = position.x + ray.x * t, z = position.z + ray.z * t
        minX = Math.min(minX, x); maxX = Math.max(maxX, x)
        minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z)
      }
    }
    const dx = Math.max(0, b.minX + margin - minX) - Math.max(0, maxX - (b.maxX - margin))
    const dz = Math.max(0, b.minZ + margin - minZ) - Math.max(0, maxZ - (b.maxZ - margin))
    if (Math.abs(dx) < 0.01 && Math.abs(dz) < 0.01) break
    aim.x += dx
    aim.z += dz
  }
  return aim
}

/** A focused shot: the lens, and the orientation that keeps the frame on the board (see `keepOnBoard`). */
export function hotspotShot(position: Vec3, h: Hotspot, aspect: number, wideFov: number, b: Bounds): { fov: number; quat: Quaternion } {
  const fov = hotspotFov(position, h, aspect, wideFov)
  return { fov, quat: aimQuaternion(position, keepOnBoard(position, h.point, h.rollDeg, fov, aspect, b), h.rollDeg) }
}

/** Smoothstep: eases in and out, clamped to 0..1. */
export function easeInOut(t: number): number {
  const x = clamp(t, 0, 1)
  return x * x * (3 - 2 * x)
}

/** Interpolates a field of view in log space, so the zoom rate feels constant. */
export function lerpFov(a: number, b: number, t: number): number {
  return a * Math.pow(b / a, t)
}

const hitSphere = new Sphere()
const hitPoint = new Vector3()

/** The hotspot whose click sphere the ray enters first, or null. */
export function pickHotspot(ray: Ray, hotspots: readonly Hotspot[]): string | null {
  let best: string | null = null
  let bestDistance = Infinity
  for (const h of hotspots) {
    hitSphere.set(hitPoint.set(h.point.x, h.point.y, h.point.z), h.hitRadius)
    const hit = ray.intersectSphere(hitSphere, hitPoint)
    if (!hit) continue
    const d = ray.origin.distanceTo(hit)
    if (d < bestDistance) {
      bestDistance = d
      best = h.id
    }
  }
  return best
}
