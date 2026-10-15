import { PerspectiveCamera, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import type { Bounds, Vec3 } from '../camera/math'
import { SPOT_ELEVATION_DEG, SPOT_PENUMBRA, SPOT_TILT_DEG, spotRig } from './spot'

const RAD2DEG = 180 / Math.PI

// The board the live app reports (stretched, frameless).
const BOARD: Bounds = { minX: -884.73, maxX: 911.15, minY: -0.5, maxY: 35.76, minZ: -482.25, maxZ: 543.98 }
const centre = (b: Bounds) => ({ x: (b.minX + b.maxX) / 2, z: (b.minZ + b.maxZ) / 2 })
const deg = (r: number) => (r * 180) / Math.PI
const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z })
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z
const len = (a: Vec3) => Math.hypot(a.x, a.y, a.z)
/** Angle between the light's axis and the direction from the light to a point. */
const offAxis = (rig: ReturnType<typeof spotRig>, p: Vec3) => {
  const axis = sub(rig.target, rig.position)
  const to = sub(p, rig.position)
  return Math.acos(dot(axis, to) / (len(axis) * len(to)))
}
/** Distance along the light's axis to a point: what the shadow camera's near and far are measured in. */
const depth = (rig: ReturnType<typeof spotRig>, p: Vec3) => {
  const axis = sub(rig.target, rig.position)
  return dot(sub(p, rig.position), axis) / len(axis)
}

describe('spotRig', () => {
  const rig = spotRig(BOARD)

  it('hangs straight above the middle of the board and aims straight down at it when not tilted', () => {
    const c = centre(BOARD)
    const upright = spotRig(BOARD, undefined, 0)
    expect(upright.position.x).toBeCloseTo(c.x)
    expect(upright.position.z).toBeCloseTo(c.z)
    expect(upright.target.x).toBeCloseTo(c.x)
    expect(upright.target.z).toBeCloseTo(c.z)
    expect(upright.target.y).toBe(BOARD.minY)
  })
  it('is tilted toward the north by default, still aimed at the middle of the board, so shadows fall toward the viewer', () => {
    const c = centre(BOARD)
    expect(SPOT_TILT_DEG).toBeGreaterThan(0)
    expect(rig.target.x).toBeCloseTo(c.x)
    expect(rig.target.z).toBeCloseTo(c.z)
    expect(rig.position.x).toBeCloseTo(c.x)
    expect(rig.position.z).toBeLessThan(rig.target.z) // north is -z
    const axis = sub(rig.target, rig.position)
    expect(deg(Math.acos(-axis.y / len(axis)))).toBeCloseTo(SPOT_TILT_DEG) // from straight down
  })
  it('is well above the highest hill, so it can never end up inside the terrain', () => {
    expect(rig.position.y).toBeGreaterThan(BOARD.maxY * 10)
  })
  it('has a wide cone: it reaches past both far corners of the board, so the light eases off right across them', () => {
    for (const x of [BOARD.minX, BOARD.maxX]) {
      expect(rig.angle).toBeGreaterThan(offAxis(rig, { x, y: BOARD.minY, z: BOARD.minZ }))
    }
    expect(rig.angle).toBeLessThan(Math.PI / 2)
  })
  it('has a fully soft edge: the light eases off from the middle to the rim of the cone', () => {
    expect(SPOT_PENUMBRA).toBe(1)
    expect(rig.penumbra).toBe(SPOT_PENUMBRA)
  })
  it('scales with the board: a board twice as wide gets a light twice as high, so the falloff looks the same', () => {
    const wide = spotRig({ ...BOARD, minX: BOARD.minX * 2, maxX: BOARD.maxX * 2 })
    expect(wide.position.y).toBeGreaterThan(rig.position.y * 1.5)
  })
  it('can be centred on another ground point, e.g. the middle of what the screen shows', () => {
    const focus = { x: -115, z: -100 }
    const r = spotRig(BOARD, focus)
    expect(r.target.x).toBe(-115)
    expect(r.target.z).toBe(-100)
    expect(r.position.x).toBe(-115)
    expect(r.position.y).toBeCloseTo(rig.position.y) // same height: it depends on the board, not on where it is aimed
  })
  it('keeps the far top corners inside the cone when centred elsewhere', () => {
    const r = spotRig(BOARD, { x: -115, z: -100 })
    for (const x of [BOARD.minX, BOARD.maxX]) {
      expect(r.angle).toBeGreaterThan(offAxis(r, { x, y: BOARD.minY, z: BOARD.minZ }))
    }
  })
  it('has a shadow range that brackets every point of the board, hills included, and is short for depth precision', () => {
    for (const x of [BOARD.minX, BOARD.maxX]) {
      for (const z of [BOARD.minZ, BOARD.maxZ]) {
        for (const y of [BOARD.minY, BOARD.maxY]) {
          const d = depth(rig, { x, y, z })
          expect(d).toBeGreaterThan(rig.near)
          expect(d).toBeLessThan(rig.far)
        }
      }
    }
    expect(rig.near).toBeGreaterThan(0)
    expect(rig.far - rig.near).toBeLessThan(1000)
  })
  it('stands 60 degrees above the horizon, seen from the middle of the pool', () => {
    expect(SPOT_ELEVATION_DEG).toBe(60)
    expect(SPOT_TILT_DEG).toBeCloseTo(30)
  })
  it('has a shadow camera that holds the whole board (as three builds it) and is tighter than the light cone', () => {
    for (const focus of [undefined, { x: -115, z: -100 }]) {
      const r = spotRig(BOARD, focus)
      // How three.js builds a spot light's shadow camera: fov = 2 * angle * focus, square, looking at the target.
      const cam = new PerspectiveCamera(RAD2DEG * 2 * r.angle * r.shadowFocus, 1, r.near, r.far)
      cam.position.set(r.position.x, r.position.y, r.position.z)
      cam.lookAt(r.target.x, r.target.y, r.target.z)
      cam.updateMatrixWorld()
      for (const x of [BOARD.minX, BOARD.maxX]) {
        for (const y of [BOARD.minY, BOARD.maxY]) {
          for (const z of [BOARD.minZ, BOARD.maxZ]) {
            const p = new Vector3(x, y, z).project(cam)
            expect(Math.abs(p.x)).toBeLessThanOrEqual(1)
            expect(Math.abs(p.y)).toBeLessThanOrEqual(1)
          }
        }
      }
      expect(r.shadowFocus).toBeGreaterThan(0)
      expect(r.shadowFocus).toBeLessThan(1)
    }
  })
  it('does not modify the bounds it is given', () => {
    const copy = { ...BOARD }
    spotRig(copy)
    expect(copy).toEqual(BOARD)
  })
})
