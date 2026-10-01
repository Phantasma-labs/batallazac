import { Box3, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import {
  MAX_DISTANCE,
  MIN_DISTANCE,
  PAN_SPEED,
  TILT_DEG,
  VFOV_DEG,
  boundsFromBox,
  clampTarget,
  defaultFraming,
  fitDistance,
  panVector,
  type Bounds,
} from './math'

// Deliberately not centred on the origin and not square (like the real floor),
// so a hardcoded origin or square assumption fails.
const FLOOR: Bounds = { minX: -335.56, maxX: 382.77, minY: 5.19, maxY: 44.55, minZ: -939.54, maxZ: 284.98 }
const NORTH = { x: 0, z: -1 } // camera looking toward -z (Blender +y)

describe('boundsFromBox', () => {
  it('maps a Box3 to Bounds', () => {
    const b = boundsFromBox(new Box3(new Vector3(1, 2, 3), new Vector3(4, 5, 6)))
    expect(b).toEqual({ minX: 1, maxX: 4, minY: 2, maxY: 5, minZ: 3, maxZ: 6 })
  })
})

describe('clampTarget', () => {
  it('leaves a point inside the bounds unchanged', () => {
    expect(clampTarget({ x: 10, y: 20, z: -300 }, FLOOR)).toEqual({ x: 10, y: 20, z: -300 })
  })
  it('clamps each axis independently to the bounds', () => {
    expect(clampTarget({ x: 9999, y: -50, z: -9999 }, FLOOR)).toEqual({ x: FLOOR.maxX, y: FLOOR.minY, z: FLOOR.minZ })
  })
})

describe('fitDistance', () => {
  it('fits the board width for a 16:9 view (about 990 units for a 718-wide board)', () => {
    const d = fitDistance(FLOOR, VFOV_DEG, 16 / 9)
    expect(d).toBeGreaterThan(980)
    expect(d).toBeLessThan(1005)
  })
  it('pulls back further for a portrait window so the board is not cropped', () => {
    expect(fitDistance(FLOOR, VFOV_DEG, 0.5)).toBeGreaterThan(fitDistance(FLOOR, VFOV_DEG, 16 / 9) * 2)
  })
  it('never leaves the allowed zoom range', () => {
    const huge: Bounds = { ...FLOOR, minX: -1e6, maxX: 1e6 }
    const flat: Bounds = { ...FLOOR, minX: 5, maxX: 5 }
    expect(fitDistance(huge, VFOV_DEG, 16 / 9)).toBe(MAX_DISTANCE)
    expect(fitDistance(flat, VFOV_DEG, 16 / 9)).toBe(MIN_DISTANCE)
  })
})

describe('defaultFraming', () => {
  const { target, position } = defaultFraming(FLOOR, 1000)
  it('targets the centre of the bounds', () => {
    expect(target.x).toBeCloseTo((FLOOR.minX + FLOOR.maxX) / 2)
    expect(target.y).toBeCloseTo((FLOOR.minY + FLOOR.maxY) / 2)
    expect(target.z).toBeCloseTo((FLOOR.minZ + FLOOR.maxZ) / 2)
  })
  it('places the camera at the requested distance, above and south of the target', () => {
    const dx = position.x - target.x, dy = position.y - target.y, dz = position.z - target.z
    expect(Math.hypot(dx, dy, dz)).toBeCloseTo(1000)
    expect(dy).toBeGreaterThan(0)
    expect(dz).toBeGreaterThan(0)
    expect(dx).toBeCloseTo(0)
  })
  it('tilts TILT_DEG away from straight down', () => {
    const deg = (Math.atan2(position.z - target.z, position.y - target.y) * 180) / Math.PI
    expect(deg).toBeCloseTo(TILT_DEG)
  })
})

describe('panVector', () => {
  const k = (...keys: string[]) => new Set(keys)
  const dist = 1000, dt = 0.5
  const step = PAN_SPEED * dist * dt

  it('does nothing with no keys held', () => {
    expect(panVector(k(), NORTH, dist, dt)).toEqual({ x: 0, z: 0 })
  })
  it('moves along the camera heading for w / arrowup', () => {
    const v = panVector(k('w'), NORTH, dist, dt)
    expect(v.x).toBeCloseTo(0)
    expect(v.z).toBeCloseTo(-step)
    expect(panVector(k('arrowup'), NORTH, dist, dt).z).toBeCloseTo(-step)
  })
  it('moves back for s / arrowdown and right (east, +x) for d / arrowright when facing north', () => {
    expect(panVector(k('s'), NORTH, dist, dt).z).toBeCloseTo(step)
    expect(panVector(k('d'), NORTH, dist, dt).x).toBeCloseTo(step)
    expect(panVector(k('arrowright'), NORTH, dist, dt).x).toBeCloseTo(step)
    expect(panVector(k('a'), NORTH, dist, dt).x).toBeCloseTo(-step)
  })
  it('follows the camera heading when it is rotated (facing east, forward is +x, right is +z)', () => {
    const v = panVector(k('w'), { x: 1, z: 0 }, dist, dt)
    expect(v.x).toBeCloseTo(step)
    expect(v.z).toBeCloseTo(0)
    expect(panVector(k('d'), { x: 1, z: 0 }, dist, dt).z).toBeCloseTo(step)
  })
  it('cancels opposite keys', () => {
    expect(panVector(k('w', 's'), NORTH, dist, dt)).toEqual({ x: 0, z: 0 })
    expect(panVector(k('a', 'd'), NORTH, dist, dt)).toEqual({ x: 0, z: 0 })
  })
  it('does not move faster on a diagonal', () => {
    const v = panVector(k('w', 'd'), NORTH, dist, dt)
    expect(Math.hypot(v.x, v.z)).toBeCloseTo(step)
  })
  it('scales with zoom distance and frame time', () => {
    expect(panVector(k('w'), NORTH, 2 * dist, dt).z).toBeCloseTo(-2 * step)
    expect(panVector(k('w'), NORTH, dist, dt / 2).z).toBeCloseTo(-step / 2)
  })
  it('ignores a heading that is not normalised and a zero heading', () => {
    expect(panVector(k('w'), { x: 0, z: -7 }, dist, dt).z).toBeCloseTo(-step)
    expect(panVector(k('w'), { x: 0, z: 0 }, dist, dt)).toEqual({ x: 0, z: 0 })
  })
  it('ignores keys it does not use', () => {
    expect(panVector(k('q', 'enter', 'shift'), NORTH, dist, dt)).toEqual({ x: 0, z: 0 })
  })
})
