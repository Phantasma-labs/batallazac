import type { Quaternion } from 'three'
import { aimQuaternion, hotspotFov, keepOnBoard, type Hotspot } from './locked'
import type { Bounds, Vec3 } from './math'

/** Where the camera stands, what it looks at, the lens (vertical, degrees) and the roll (degrees). */
export type ShotPose = { position: Vec3; target: Vec3; fov: number; rollDeg: number }

/**
 * Hand-tuned values for individual shots, in world coordinates after the floor's stretch. Anything a shot does not
 * set is solved automatically: the tripod position, the aim and lens that fit the hotspot, and its roll. A shot that
 * sets `target` and `fov` is used exactly as given. Keyed by shot id (a hotspot id, or an event shot below).
 */
export const BAKED: Record<string, Partial<ShotPose>> = {}

const dist = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)

/** A shot that frames the ground between two places (a march): not clickable, so it is a hotspot without a click target. */
export function spanShot(id: string, a: Vec3, b: Vec3, rollDeg = 0, margin = 1.25, pad = 35): Hotspot {
  return {
    id,
    point: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 },
    radius: (dist(a, b) / 2) * margin + pad,
    hitRadius: 0,
    rollDeg,
  }
}

/** The shots only events use: each frames one march. Ids are the `shot` of the events in timeline/events.ts. */
export function eventShots(places: ReadonlyMap<string, Vec3>): Hotspot[] {
  const at = (id: string) => {
    const p = places.get(id)
    if (!p) throw new Error(`no place "${id}"`)
    return p
  }
  return [
    spanShot('march-villa-sierpe', at('villa-camp'), at('sierpe'), -1.5),
    spanShot('march-vetagrande-loreto', at('vetagrande'), at('loreto'), 1.5),
  ]
}

export type SolvedShot = { position: Vec3; fov: number; quat: Quaternion; /** Distance from the camera to what it looks at. */ distance: number }

/** Solves one shot for this window shape: the tripod position unless `baked` moves it, and automatic aim and lens unless it sets them. */
export function solveShot(tripod: Vec3, h: Hotspot, aspect: number, wideFov: number, b: Bounds, baked: Partial<ShotPose> = BAKED[h.id] ?? {}): SolvedShot {
  const position = baked.position ?? tripod
  const roll = baked.rollDeg ?? h.rollDeg
  const fov = baked.fov ?? hotspotFov(position, h, aspect, wideFov)
  // The tripod's frame is kept on the board (the aim may slide off the hotspot to do it). A camera the author moved
  // looks straight at the hotspot instead: that correction is meant for the high tripod and can run away from a low one.
  const target = baked.target ?? (baked.position ? h.point : keepOnBoard(position, h.point, roll, fov, aspect, b))
  return { position, fov, quat: aimQuaternion(position, target, roll), distance: dist(position, baked.target ?? h.point) }
}
