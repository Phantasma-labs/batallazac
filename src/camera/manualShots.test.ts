import { Quaternion, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import {
  MANUAL_SHOTS,
  SHOT_KEYS,
  SHOT_MINUTES,
  cameraSource,
  centreFocusDistance,
  focalLengthMm,
  fovFromFocalLength,
  fovFromZoom,
  parseShots,
  poseAngles,
  poseQuaternion,
  shotsToJson,
  zoomOf,
  type ManualShot,
} from './manualShots'

const shot = (patch: Partial<ManualShot> = {}): ManualShot => ({
  position: { x: 10, y: 200, z: 300 },
  yawDeg: 0,
  pitchDeg: 30,
  rollDeg: 0,
  fovDeg: 20,
  dof: { focusDistance: 400, blur: 5, range: 80 },
  ...patch,
})

const forward = (q: Quaternion) => new Vector3(0, 0, -1).applyQuaternion(q)

describe('the shot times', () => {
  it('are the seven points of the day, in order', () => {
    expect(SHOT_KEYS).toEqual(['10:00', '11:00', '11:30', '12:00', '13:00', '16:00', '17:00', '18:00', '19:00'])
    expect(SHOT_KEYS.map((k) => SHOT_MINUTES[k])).toEqual([600, 660, 690, 720, 780, 960, 1020, 1080, 1140])
  })
})

describe('the committed shots', () => {
  it('has a hand-placed camera for each of the seven points', () => {
    expect(Object.keys(MANUAL_SHOTS)).toEqual([...SHOT_KEYS])
  })
  it('is well-formed (every number finite, the lens inside the range the panel allows)', () => {
    expect(parseShots(JSON.stringify({ shots: MANUAL_SHOTS }))).toEqual(MANUAL_SHOTS)
    for (const s of Object.values(MANUAL_SHOTS)) {
      expect(s.fovDeg).toBeGreaterThan(1)
      expect(s.fovDeg).toBeLessThan(75)
      expect(s.dof.focusDistance).toBeGreaterThan(0)
    }
  })
})

describe('poseQuaternion', () => {
  it('looks north (-z) at zero', () => {
    expect(forward(poseQuaternion(0, 0, 0)).angleTo(new Vector3(0, 0, -1))).toBeCloseTo(0, 6)
  })
  it('turns the heading clockwise seen from above: 90 degrees faces east (+x)', () => {
    expect(forward(poseQuaternion(90, 0, 0)).angleTo(new Vector3(1, 0, 0))).toBeCloseTo(0, 6)
  })
  it('pitches down for a positive pitch', () => {
    const f = forward(poseQuaternion(0, 30, 0))
    expect(f.y).toBeCloseTo(-Math.sin(Math.PI / 6), 6)
    expect(f.z).toBeLessThan(0)
  })
  it('rolls about the lens axis without moving where it looks', () => {
    expect(forward(poseQuaternion(40, 25, 0)).angleTo(forward(poseQuaternion(40, 25, 12)))).toBeCloseTo(0, 6)
    expect(poseQuaternion(40, 25, 0).angleTo(poseQuaternion(40, 25, 12))).toBeCloseTo((12 * Math.PI) / 180, 6)
  })
})

describe('poseAngles', () => {
  it('reads back what poseQuaternion was given', () => {
    for (const [yaw, pitch, roll] of [[0, 30, 0], [-75, 41.5, 3], [170, -10, -8], [33, 89, 0]]) {
      const a = poseAngles(poseQuaternion(yaw, pitch, roll))
      expect(a.yawDeg).toBeCloseTo(yaw, 4)
      expect(a.pitchDeg).toBeCloseTo(pitch, 4)
      expect(a.rollDeg).toBeCloseTo(roll, 4)
    }
  })
})

describe('zoom and lens', () => {
  it('zoom is the magnification against the wide shot', () => {
    expect(zoomOf(23, 23)).toBeCloseTo(1, 9)
    expect(zoomOf(23, 11.5)).toBeGreaterThan(1.9)
    expect(zoomOf(23, 11.5)).toBeLessThan(2.1)
  })
  it('turns a zoom back into the lens that gave it', () => {
    expect(fovFromZoom(23, zoomOf(23, 7.3))).toBeCloseTo(7.3, 6)
  })
  it('focal length is the full-frame equivalent for the vertical field of view', () => {
    // A 24 mm tall sensor: 12 / tan(fov / 2).
    expect(focalLengthMm(2 * (Math.atan(12 / 50) * 180) / Math.PI)).toBeCloseTo(50, 6)
    expect(fovFromFocalLength(focalLengthMm(17.5))).toBeCloseTo(17.5, 6)
  })
})

describe('cameraSource', () => {
  const placed = { '10:00': shot(), '12:00': shot() }
  it('holds the shot being edited, whatever the director says', () => {
    expect(cameraSource(placed, '12:00', true)).toEqual({ kind: 'edit', key: '12:00' })
    expect(cameraSource(placed, '12:00', false)).toEqual({ kind: 'edit', key: '12:00' })
  })
  it('is the wide shot for an edited key that is not placed', () => {
    expect(cameraSource(placed, '11:00', true)).toEqual({ kind: 'wide' })
  })
  it('flows through the keyframes while the director has the camera', () => {
    expect(cameraSource(placed, null, true)).toEqual({ kind: 'track' })
  })
  it('is the wide shot once the viewer has taken the camera, and when no shot is placed', () => {
    expect(cameraSource(placed, null, false)).toEqual({ kind: 'wide' })
    expect(cameraSource({}, null, true)).toEqual({ kind: 'wide' })
  })
})

describe('centreFocusDistance', () => {
  it('is the distance along the lens axis to the ground plane', () => {
    const q = poseQuaternion(0, 30, 0)
    expect(centreFocusDistance({ x: 0, y: 100, z: 0 }, q, 0)).toBeCloseTo(100 / Math.sin(Math.PI / 6), 6)
  })
  it('is null when the lens looks at or above the horizon', () => {
    expect(centreFocusDistance({ x: 0, y: 100, z: 0 }, poseQuaternion(0, 0, 0), 0)).toBeNull()
    expect(centreFocusDistance({ x: 0, y: 100, z: 0 }, poseQuaternion(0, -10, 0), 0)).toBeNull()
  })
})

describe('shotsToJson', () => {
  it('lists the placed shots by time, rounded, with the window they were judged in', () => {
    const text = shotsToJson({ '12:00': shot({ position: { x: 1.23456, y: 2.34567, z: 3.45678 }, fovDeg: 7.123456 }) }, { width: 1024, height: 600 })
    const json = JSON.parse(text)
    expect(json.window).toEqual({ width: 1024, height: 600, aspect: 1.707 })
    expect(Object.keys(json.shots)).toEqual(['12:00'])
    expect(json.shots['12:00'].position).toEqual({ x: 1.23, y: 2.35, z: 3.46 })
    expect(json.shots['12:00'].fovDeg).toBe(7.12)
    expect(json.shots['12:00'].dof).toEqual({ focusDistance: 400, blur: 5, range: 80 })
  })
  it('writes the shots in time order whatever order they were placed in', () => {
    const json = JSON.parse(shotsToJson({ '19:00': shot(), '10:00': shot() }, { width: 1024, height: 600 }))
    expect(Object.keys(json.shots)).toEqual(['10:00', '19:00'])
  })
})

describe('parseShots', () => {
  it('reads back what shotsToJson wrote', () => {
    const text = shotsToJson({ '11:00': shot(), '17:00': shot({ rollDeg: -2 }) }, { width: 1024, height: 600 })
    expect(parseShots(text)).toEqual({ '11:00': shot(), '17:00': shot({ rollDeg: -2 }) })
  })
  it('drops anything malformed instead of throwing', () => {
    expect(parseShots(null)).toEqual({})
    expect(parseShots('not json')).toEqual({})
    expect(parseShots(JSON.stringify({ shots: { '10:00': { position: { x: 1 } }, '99:00': shot(), '12:00': shot() } }))).toEqual({ '12:00': shot() })
  })
})
