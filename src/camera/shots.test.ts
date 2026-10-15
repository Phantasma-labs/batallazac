import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { HOTSPOTS } from './hotspots'
import { hotspotShot, lockedRig } from './locked'
import type { Bounds } from './math'
import { eventShots, solveShot, spanShot } from './shots'

const bounds: Bounds = { minX: -700, maxX: 700, minY: 0, maxY: 60, minZ: -400, maxZ: 400, rimY: 0 }
const rig = lockedRig(bounds)
const forward = (q: { x: number; y: number; z: number; w: number }) => new Vector3(0, 0, -1).applyQuaternion(q as never)

describe('solveShot', () => {
  it('matches the tripod hotspot shot when nothing is baked', () => {
    const h = HOTSPOTS[1]
    const auto = hotspotShot(rig.position, h, 16 / 9, 40, bounds)
    const s = solveShot(rig.position, h, 16 / 9, 40, bounds, {})
    expect(s.position).toEqual(rig.position)
    expect(s.fov).toBeCloseTo(auto.fov)
    expect(s.quat.angleTo(auto.quat)).toBeCloseTo(0, 5)
  })
  it('moves the camera when the shot sets its own position', () => {
    const h = HOTSPOTS[1]
    const position = { x: h.point.x + 50, y: 120, z: h.point.z + 200 }
    const s = solveShot(rig.position, h, 16 / 9, 40, bounds, { position })
    expect(s.position).toEqual(position)
    // Still looking toward the hotspot from there.
    const toHotspot = new Vector3(h.point.x - position.x, h.point.y - position.y, h.point.z - position.z).normalize()
    expect(forward(s.quat).angleTo(toHotspot)).toBeLessThan(0.01)
    expect(s.distance).toBeCloseTo(Math.hypot(50, 120 - h.point.y, 200), 3)
  })
  it('uses a fully baked shot exactly as given', () => {
    const h = HOTSPOTS[1]
    const baked = { position: { x: 0, y: 100, z: 300 }, target: { x: 0, y: 0, z: 0 }, fov: 12, rollDeg: 0 }
    const s = solveShot(rig.position, h, 16 / 9, 40, bounds, baked)
    expect(s.fov).toBe(12)
    const want = new Vector3(0, -100, -300).normalize()
    expect(forward(s.quat).angleTo(want)).toBeCloseTo(0, 5)
    expect(s.distance).toBeCloseTo(Math.hypot(100, 300), 5)
  })
})

describe('event shots', () => {
  it('frames the two ends of a march, with room around them', () => {
    const a = { x: 0, y: 0, z: 0 }, b = { x: 100, y: 0, z: 0 }
    const h = spanShot('x', a, b)
    expect(h.point).toEqual({ x: 50, y: 0, z: 0 })
    expect(h.radius).toBeGreaterThan(50)
    expect(h.hitRadius).toBe(0)
  })
  it('has the shots the events ask for', () => {
    const places = new Map([
      ['villa-camp', { x: -623, y: 2, z: -197 }],
      ['sierpe', { x: -623, y: 20, z: 23 }],
      ['vetagrande', { x: 193, y: 12, z: -277 }],
      ['loreto', { x: 45, y: 20, z: -65 }],
    ])
    expect(eventShots(places).map((h) => h.id)).toEqual(['march-villa-sierpe', 'march-vetagrande-loreto'])
    expect(() => eventShots(new Map())).toThrow()
  })
})
