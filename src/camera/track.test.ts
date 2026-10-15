import { describe, expect, it } from 'vitest'
import type { ManualShot } from './manualShots'
import { buildTrack, followFactor, pchip, trackKeys } from './track'

const shot = (patch: Partial<ManualShot> = {}): ManualShot => ({
  position: { x: 0, y: 1000, z: 900 },
  yawDeg: 0,
  pitchDeg: 60,
  rollDeg: 0,
  fovDeg: 20,
  dof: { focusDistance: 2000, blur: 0, range: 100 },
  ...patch,
})

const range = (from: number, to: number, n: number) => Array.from({ length: n + 1 }, (_, i) => from + ((to - from) * i) / n)

describe('pchip (a smooth curve through the points that never overshoots them)', () => {
  it('passes through every point', () => {
    const xs = [0, 60, 120, 180], ys = [3, 9, -2, 4]
    const f = pchip(xs, ys)
    xs.forEach((x, i) => expect(f(x)).toBeCloseTo(ys[i], 9))
  })
  it('stays a straight line on straight data, however unevenly spaced', () => {
    const f = pchip([0, 10, 50, 60], [0, 10, 50, 60])
    for (const x of range(0, 60, 24)) expect(f(x)).toBeCloseTo(x, 9)
  })
  it('never leaves the range of the two points it is between when the data keeps going one way', () => {
    const f = pchip([0, 1, 2, 3], [0, 0.1, 9.9, 10])
    for (const x of range(0, 3, 300)) {
      expect(f(x)).toBeGreaterThanOrEqual(-1e-9)
      expect(f(x)).toBeLessThanOrEqual(10 + 1e-9)
    }
    const samples = range(0, 3, 300).map(f)
    samples.slice(1).forEach((v, i) => expect(v).toBeGreaterThanOrEqual(samples[i] - 1e-9)) // never goes back
  })
  it('holds a flat stretch flat', () => {
    const f = pchip([0, 1, 2, 3], [5, 5, 5, 9])
    for (const x of range(0, 2, 50)) expect(f(x)).toBeCloseTo(5, 9)
  })
  it('eases to a stop at a peak instead of overshooting it', () => {
    const f = pchip([0, 1, 2], [0, 10, 0])
    for (const x of range(0, 2, 200)) expect(f(x)).toBeLessThanOrEqual(10 + 1e-9)
  })
  it('keeps moving through a point where the data keeps going one way (no stop, no kink)', () => {
    const f = pchip([0, 1, 2, 3], [0, 1, 3, 4])
    const eps = 1e-5
    const left = (f(1) - f(1 - eps)) / eps
    const right = (f(1 + eps) - f(1)) / eps
    expect(left).toBeGreaterThan(0.2)
    expect(left).toBeCloseTo(right, 3)
  })
  it('holds the end values outside the points', () => {
    const f = pchip([10, 20, 30], [1, 2, 4])
    expect(f(-100)).toBe(1)
    expect(f(1000)).toBe(4)
  })
  it('copes with one point and with two', () => {
    expect(pchip([5], [7])(123)).toBe(7)
    const f = pchip([0, 10], [0, 100])
    expect(f(5)).toBeCloseTo(50, 9)
  })
})

describe('trackKeys', () => {
  it('puts the wide shot first, then the placed shots in time order at their bar time', () => {
    const wide = shot({ fovDeg: 24 })
    const keys = trackKeys(wide, { '12:00': shot({ fovDeg: 10 }), '10:00': shot({ fovDeg: 9 }) }, (m) => m / 10)
    expect(keys.map((k) => k.time)).toEqual([0, 60, 72, 120])
    expect(keys.map((k) => k.pose.fovDeg)).toEqual([24, 9, 10, 24])
  })
  it('is just the wide shot when nothing is placed', () => {
    expect(trackKeys(shot(), {}, (m) => m)).toHaveLength(2)
  })
})

describe('buildTrack', () => {
  const keys = [
    { time: 0, pose: shot({ position: { x: 0, y: 1000, z: 900 }, fovDeg: 24, dof: { focusDistance: 2000, blur: 0, range: 100 } }) },
    { time: 60, pose: shot({ position: { x: 300, y: 2000, z: 900 }, fovDeg: 10, dof: { focusDistance: 2500, blur: 6, range: 50 } }) },
    { time: 120, pose: shot({ position: { x: 100, y: 1500, z: 800 }, fovDeg: 12, pitchDeg: 50, rollDeg: 4 }) },
  ]
  const at = buildTrack(keys)

  it('is exactly each shot at its time', () => {
    for (const k of keys) {
      const p = at(k.time)
      expect(p.position.x).toBeCloseTo(k.pose.position.x, 6)
      expect(p.position.y).toBeCloseTo(k.pose.position.y, 6)
      expect(p.position.z).toBeCloseTo(k.pose.position.z, 6)
      expect(p.pitchDeg).toBeCloseTo(k.pose.pitchDeg, 6)
      expect(p.rollDeg).toBeCloseTo(k.pose.rollDeg, 6)
      expect(p.fovDeg).toBeCloseTo(k.pose.fovDeg, 6)
      expect(p.dof.focusDistance).toBeCloseTo(k.pose.dof.focusDistance, 6)
      expect(p.dof.blur).toBeCloseTo(k.pose.dof.blur, 6)
      expect(p.dof.range).toBeCloseTo(k.pose.dof.range, 6)
    }
  })
  it('is always moving between two shots, never jumping', () => {
    let last = at(0)
    for (const t of range(0, 60, 600).slice(1)) {
      const p = at(t)
      expect(Math.abs(p.position.x - last.position.x)).toBeLessThan(5) // 300 units over 600 steps, a little more where it is fastest
      expect(Math.abs(p.fovDeg - last.fovDeg)).toBeLessThan(0.1)
      last = p
    }
    expect(at(30).position.x).toBeGreaterThan(0)
    expect(at(30).position.x).toBeLessThan(300)
  })
  it('does not stop or kink at a shot it is passing through', () => {
    const xs = [0, 100, 400]
    const pass = buildTrack([0, 60, 120].map((time, i) => ({ time, pose: shot({ position: { x: xs[i], y: 1000, z: 900 } }) })))
    const eps = 1e-4
    const left = (pass(60).position.x - pass(60 - eps).position.x) / eps
    const right = (pass(60 + eps).position.x - pass(60).position.x) / eps
    expect(left).toBeGreaterThan(1)
    expect(left).toBeCloseTo(right, 2)
  })
  it('zooms evenly: halfway between two lenses is their geometric mean', () => {
    const two = buildTrack([{ time: 0, pose: shot({ fovDeg: 10 }) }, { time: 10, pose: shot({ fovDeg: 40 }) }])
    expect(two(5).fovDeg).toBeCloseTo(20, 6)
  })
  it('turns the short way round the compass', () => {
    const two = buildTrack([{ time: 0, pose: shot({ yawDeg: 170 }) }, { time: 10, pose: shot({ yawDeg: -170 }) }])
    expect(Math.abs(two(5).yawDeg)).toBeCloseTo(180, 6)
    expect(two(10).yawDeg).toBeCloseTo(-170, 6)
  })
  it('holds the first shot before it and the last one after it', () => {
    expect(at(-50).fovDeg).toBeCloseTo(24, 9)
    expect(at(5000).fovDeg).toBeCloseTo(12, 9)
  })
  it('is the one shot when there is only one', () => {
    expect(buildTrack([{ time: 0, pose: shot({ fovDeg: 7 }) }])(99).fovDeg).toBeCloseTo(7, 9)
  })
})

describe('followFactor', () => {
  it('is 0 for no time and tends to 1', () => {
    expect(followFactor(0, 0.3)).toBe(0)
    expect(followFactor(10, 0.3)).toBeGreaterThan(0.999)
  })
  it('gives the same result whatever the frame rate', () => {
    const half = followFactor(0.008, 0.3)
    expect(1 - (1 - half) * (1 - half)).toBeCloseTo(followFactor(0.016, 0.3), 12)
  })
})
