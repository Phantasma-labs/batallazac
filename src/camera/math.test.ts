import { Box3, PerspectiveCamera, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import {
  FRAMING_MARGIN,
  MAX_DISTANCE,
  MIN_DISTANCE,
  PAN_SPEED,
  TILT_DEG,
  VFOV_DEG,
  boundsFromBox,
  clampCameraHeight,
  clampTarget,
  coverDistance,
  cropEast,
  cornersOf,
  defaultFraming,
  fitDistance,
  maxDistanceFor,
  insetCorners,
  lowestRimY,
  openingFraming,
  panVector,
  rimOf,
  viewFootprint,
  type Bounds,
  type Vec3,
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

describe('boundsFromBox with no geometry', () => {
  it('throws instead of returning infinite bounds (an empty floor export must not give a blank canvas)', () => {
    expect(() => boundsFromBox(new Box3())).toThrow(/no geometry/)
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
  it('fits the board width at the FAR edge of a 16:9 view (about 880 units for a 718-wide board)', () => {
    const d = fitDistance(FLOOR, VFOV_DEG, 16 / 9)
    expect(d).toBeGreaterThan(870)
    expect(d).toBeLessThan(892)
  })
  it('pulls back further for a portrait window so the board is not cropped', () => {
    expect(fitDistance(FLOOR, VFOV_DEG, 0.5)).toBeGreaterThan(fitDistance(FLOOR, VFOV_DEG, 16 / 9) * 2)
  })
  it('never leaves the allowed zoom range', () => {
    const huge: Bounds = { ...FLOOR, minX: -1e6, maxX: 1e6 }
    const flat: Bounds = { ...FLOOR, minX: 5, maxX: 5 }
    expect(fitDistance(huge, VFOV_DEG, 16 / 9)).toBeLessThanOrEqual(maxDistanceFor(huge))
    expect(fitDistance(flat, VFOV_DEG, 16 / 9)).toBe(MIN_DISTANCE)
    // an absurdly narrow window cannot push the camera past the zoom cap either
    expect(fitDistance(FLOOR, VFOV_DEG, 0.05)).toBe(maxDistanceFor(FLOOR))
  })
  it('still fits a wider re-done floor in a portrait window instead of clamping at a fixed cap', () => {
    const wider: Bounds = { ...FLOOR, minX: -420, maxX: 420 }
    const d = fitDistance(wider, VFOV_DEG, 0.4)
    expect(d).toBeGreaterThan(MAX_DISTANCE) // the far-edge fit for an 840-wide board at aspect 0.4 is about 4580
    expect(d).toBeLessThanOrEqual(maxDistanceFor(wider))
  })
})

describe('cornersOf', () => {
  it('returns the 8 distinct corners of a box', () => {
    const c = cornersOf(new Box3(new Vector3(1, 2, 3), new Vector3(4, 5, 6)))
    expect(c).toHaveLength(8)
    expect(new Set(c.map((p) => `${p.x},${p.y},${p.z}`)).size).toBe(8)
    expect(c).toContainEqual({ x: 1, y: 2, z: 3 })
    expect(c).toContainEqual({ x: 4, y: 5, z: 6 })
  })
})

/** Where a world point lands in a real three.js camera framed by defaultFraming at this distance: x and y in -1..1 when visible. */
function ndcAt(p: Vec3, b: Bounds, distance: number, vfov: number, aspect: number): Vector3 {
  const { target, position } = defaultFraming(b, distance)
  const cam = new PerspectiveCamera(vfov, aspect, 1, 1e6)
  cam.position.set(position.x, position.y, position.z)
  cam.lookAt(target.x, target.y, target.z)
  cam.updateMatrixWorld()
  return new Vector3(p.x, p.y, p.z).project(cam)
}
const worst = (v: Vector3) => Math.max(Math.abs(v.x), Math.abs(v.y))

describe('coverDistance', () => {
  const target = defaultFraming(FLOOR, 1).target
  // a corner far to the north-west, which the default board-width framing crops off the top of the screen
  const nw: Vec3 = { x: -300, y: 20, z: -900 }
  const ne: Vec3 = { x: 300, y: 20, z: -900 }

  it('asks for no distance when there is nothing to cover', () => {
    expect(coverDistance(target, [], VFOV_DEG, 16 / 9, FRAMING_MARGIN)).toBe(0)
  })
  it('puts every point inside the frame and the limiting one exactly on the margin (checked with a real camera)', () => {
    const d = coverDistance(target, [nw, ne], VFOV_DEG, 16 / 9, FRAMING_MARGIN)
    const w = [nw, ne].map((p) => worst(ndcAt(p, FLOOR, d, VFOV_DEG, 16 / 9)))
    expect(Math.max(...w)).toBeCloseTo(1 - FRAMING_MARGIN, 3)
    expect(Math.min(...w)).toBeLessThanOrEqual(1 - FRAMING_MARGIN + 1e-9)
  })
  it('also covers points that are limited by the window width, not its height', () => {
    const wide: Vec3 = { x: 380, y: 20, z: 280 } // east edge, south of centre: the horizontal limit binds in a tall window
    const d = coverDistance(target, [wide], VFOV_DEG, 0.6, FRAMING_MARGIN)
    expect(worst(ndcAt(wide, FLOOR, d, VFOV_DEG, 0.6))).toBeCloseTo(1 - FRAMING_MARGIN, 3)
  })
  it('needs more distance for a bigger margin', () => {
    expect(coverDistance(target, [nw], VFOV_DEG, 16 / 9, 0.1)).toBeGreaterThan(coverDistance(target, [nw], VFOV_DEG, 16 / 9, 0))
  })
})

describe('fitDistance with points that must stay in view', () => {
  const nw: Vec3 = { x: -300, y: 20, z: -900 }
  it('pulls back so the point is inside the frame, instead of fitting only the board width', () => {
    const plain = fitDistance(FLOOR, VFOV_DEG, 16 / 9)
    const covered = fitDistance(FLOOR, VFOV_DEG, 16 / 9, [nw])
    expect(covered).toBeGreaterThan(plain)
    expect(worst(ndcAt(nw, FLOOR, covered, VFOV_DEG, 16 / 9))).toBeLessThanOrEqual(1 - FRAMING_MARGIN + 1e-9)
  })
  it('leaves the distance alone for a point that is already in view', () => {
    const nearCentre: Vec3 = { x: 0, y: 20, z: -300 }
    expect(fitDistance(FLOOR, VFOV_DEG, 16 / 9, [nearCentre])).toBe(fitDistance(FLOOR, VFOV_DEG, 16 / 9))
  })
  it('stays inside the allowed zoom range', () => {
    const absurd: Vec3 = { x: 1e6, y: 20, z: -1e6 }
    expect(fitDistance(FLOOR, VFOV_DEG, 16 / 9, [absurd])).toBe(maxDistanceFor(FLOOR))
  })
})

/** The ground point (on the plane at height y) that a screen position (-1..1) shows. */
function groundAt(cam: PerspectiveCamera, nx: number, ny: number, y: number): Vec3 {
  const dir = new Vector3(nx, ny, 0.5).unproject(cam).sub(cam.position).normalize()
  const t = (y - cam.position.y) / dir.y
  return { x: cam.position.x + dir.x * t, y, z: cam.position.z + dir.z * t }
}
function camFor(f: { position: Vec3; target: Vec3 }, vfov: number, aspect: number): PerspectiveCamera {
  const cam = new PerspectiveCamera(vfov, aspect, 1, 1e6)
  cam.position.set(f.position.x, f.position.y, f.position.z)
  cam.lookAt(f.target.x, f.target.y, f.target.z)
  cam.updateMatrixWorld()
  cam.updateProjectionMatrix()
  return cam
}

describe('viewFootprint', () => {
  it('is the ground footprint of a real camera, per unit of distance', () => {
    const f = viewFootprint(VFOV_DEG, 16 / 9)
    const fr = defaultFraming(FLOOR, 1000)
    const cam = camFor(fr, VFOV_DEG, 16 / 9)
    const topRight = groundAt(cam, 1, 1, fr.target.y)
    const bottomMid = groundAt(cam, 0, -1, fr.target.y)
    expect((topRight.x - fr.target.x) / 1000).toBeCloseTo(f.xTop, 6)
    expect((topRight.z - fr.target.z) / 1000).toBeCloseTo(f.zTop, 6)
    expect((bottomMid.z - fr.target.z) / 1000).toBeCloseTo(f.zBottom, 6)
  })
  it('has the far edge north of the target and wider than the near edge (the view is a trapezoid)', () => {
    const f = viewFootprint(VFOV_DEG, 16 / 9)
    expect(f.zTop).toBeLessThan(0)
    expect(f.zBottom).toBeGreaterThan(0)
    expect(f.xTop).toBeGreaterThan(f.xBottom)
  })
})

// the stretched board and its compass, as exported (Blender/Exports_wide)
const WIDE: Bounds = { minX: -822, maxX: 846.6, minY: -0.5, maxY: 35.76, minZ: -482.3, maxZ: 544 }
const COMPASS_W = cornersOf(new Box3(new Vector3(-764, 1.8, -480), new Vector3(-574, 9.6, -290)))

describe('openingFraming', () => {
  const centre = defaultFraming(WIDE, 1).target
  const f = openingFraming(WIDE, VFOV_DEG, 16 / 9, COMPASS_W)
  const cam = camFor(f, VFOV_DEG, 16 / 9)
  const plane = f.target.y

  it('makes the far edge of the view as wide as the board, so there are no empty corners', () => {
    const tl = groundAt(cam, -1, 1, plane), tr = groundAt(cam, 1, 1, plane)
    // the compass margin may need the view up to ~1.5% wider than the board; never narrower, never much wider
    expect(tr.x).toBeLessThanOrEqual(WIDE.maxX + 25)
    expect(tl.x).toBeGreaterThanOrEqual(WIDE.minX - 25)
    expect(tr.x).toBeGreaterThan(WIDE.maxX - 30)
  })
  it('keeps every corner of the compass inside the frame, with the margin', () => {
    for (const c of COMPASS_W) {
      const ndc = new Vector3(c.x, c.y, c.z).project(cam)
      expect(Math.max(Math.abs(ndc.x), Math.abs(ndc.y))).toBeLessThanOrEqual(1 - FRAMING_MARGIN + 1e-6)
    }
  })
  it('slides the view south (never north) and keeps it centred sideways', () => {
    expect(f.target.z).toBeGreaterThanOrEqual(centre.z)
    expect(f.target.x).toBeCloseTo(centre.x)
  })
  it('leaves little empty space above the board: the top of the view is at most about a margin past the north edge', () => {
    expect(groundAt(cam, 0, 1, plane).z).toBeGreaterThanOrEqual(WIDE.minZ - 40)
  })
  it('does not run past the south edge', () => {
    expect(groundAt(cam, 0, -1, plane).z).toBeLessThanOrEqual(WIDE.maxZ + 0.5)
  })
  it('sits on the tilt line at the stated distance from its target', () => {
    expect(Math.hypot(f.position.x - f.target.x, f.position.y - f.target.y, f.position.z - f.target.z)).toBeCloseTo(f.distance)
    expect((Math.atan2(f.position.z - f.target.z, f.position.y - f.target.y) * 180) / Math.PI).toBeCloseTo(TILT_DEG)
  })
  it('with nothing to cover, puts the north edge of the board exactly at the top of the frame: no empty strip, nothing cropped', () => {
    const g = openingFraming(WIDE, VFOV_DEG, 16 / 9)
    const c = camFor(g, VFOV_DEG, 16 / 9)
    const edge = new Vector3(centre.x, WIDE.maxY, WIDE.minZ).project(c)
    expect(edge.y).toBeCloseTo(1, 3)
  })
})

describe('cropEast', () => {
  it('keeps the west part of the board: the east edge moves in by the fraction of the width', () => {
    const b: Bounds = { minX: -100, maxX: 300, minY: 0, maxY: 40, minZ: -50, maxZ: 90, rimY: 1 }
    expect(cropEast(b, 0.25)).toEqual({ ...b, maxX: 200 })
  })
  it('changes nothing for a fraction of 0 and does not modify its input', () => {
    const b: Bounds = { minX: -100, maxX: 300, minY: 0, maxY: 40, minZ: -50, maxZ: 90 }
    expect(cropEast(b, 0)).toEqual(b)
    cropEast(b, 0.5)
    expect(b.maxX).toBe(300)
  })
})

describe('rimOf', () => {
  it('is the measured rim height when the floor reports one', () => {
    expect(rimOf({ ...FLOOR, rimY: 0.65 })).toBe(0.65)
  })
  it('falls back to the lowest point of the floor when no rim was measured', () => {
    expect(rimOf(FLOOR)).toBe(FLOOR.minY)
  })
})

describe('lowestRimY', () => {
  // A 100 x 60 board: a rim at y 1..2, a deep valley in the middle, a tall hill in the middle too.
  const board: Bounds = { minX: 0, maxX: 100, minY: -7, maxY: 40, minZ: 0, maxZ: 60 }
  const flat = (pts: number[][]) => pts.flat()
  it('is the lowest height among the points on the outer edge, ignoring the interior', () => {
    const pts = flat([
      [0, 2, 0], [100, 1, 0], [50, 1.5, 0], // north edge
      [0, 1.2, 60], [100, 2, 60], // south edge
      [0, 1.8, 30], [100, 1.4, 30], // west and east edges
      [50, -7, 30], [20, 40, 30], // valley and hill in the interior: must not count
    ])
    expect(lowestRimY(pts, board)).toBe(1)
  })
  it('counts points within the tolerance of an edge, and only those', () => {
    const pts = flat([[0.4, 3, 30], [1.5, 0, 30], [50, 5, 59.7]])
    expect(lowestRimY(pts, board, 0.5)).toBe(3)
  })
  it('falls back to the lowest point of the board when nothing sits on its edge', () => {
    expect(lowestRimY(flat([[50, 9, 30], [40, -7, 30]]), board)).toBe(board.minY)
  })
})

describe('insetCorners', () => {
  const box = new Box3(new Vector3(0, 0, 0), new Vector3(100, 10, 200))
  it('pulls the four ground-plane corners in by the fraction of each side, keeping the heights', () => {
    const pts = insetCorners(box, 0.1)
    expect(pts).toHaveLength(8)
    expect(Math.min(...pts.map((p) => p.x))).toBeCloseTo(10)
    expect(Math.max(...pts.map((p) => p.x))).toBeCloseTo(90)
    expect(Math.min(...pts.map((p) => p.z))).toBeCloseTo(20)
    expect(Math.max(...pts.map((p) => p.z))).toBeCloseTo(180)
    expect(Math.min(...pts.map((p) => p.y))).toBe(0)
    expect(Math.max(...pts.map((p) => p.y))).toBe(10)
  })
  it('is the plain corner set for a fraction of 0', () => {
    expect(insetCorners(box, 0)).toEqual(cornersOf(box))
  })
})

describe('maxDistanceFor', () => {
  it('never drops below MAX_DISTANCE', () => {
    expect(maxDistanceFor(FLOOR)).toBeGreaterThanOrEqual(MAX_DISTANCE)
  })
  it('lets the user zoom out far enough to see the whole width in a very narrow window', () => {
    for (const w of [718, 840, 1500]) {
      const b: Bounds = { ...FLOOR, minX: -w / 2, maxX: w / 2 }
      const rawFitAtAspect04 = w / 2 / (Math.tan((VFOV_DEG * Math.PI) / 360) * 0.4)
      expect(maxDistanceFor(b)).toBeGreaterThanOrEqual(rawFitAtAspect04)
    }
  })
})

describe('clampCameraHeight', () => {
  it('lifts a camera that is below the highest point of the terrain', () => {
    expect(clampCameraHeight(10, FLOOR)).toBeGreaterThan(FLOOR.maxY)
  })
  it('leaves a camera that is already clear of the terrain alone', () => {
    expect(clampCameraHeight(500, FLOOR)).toBe(500)
  })
  it('follows the floor that was actually loaded (a taller re-done floor lifts the limit)', () => {
    const tall: Bounds = { ...FLOOR, maxY: 120 }
    expect(clampCameraHeight(60, tall)).toBeGreaterThan(120)
    expect(clampCameraHeight(60, FLOOR)).toBe(60)
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
