import { Box3, PerspectiveCamera, Quaternion, Ray, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { HOTSPOTS } from './hotspots'
import {
  EDGE_MARGIN,
  MAX_FOV_DEG,
  MIN_FOV_DEG,
  aimQuaternion,
  easeInOut,
  fitFov,
  hotspotFov,
  hotspotShot,
  keepOnBoard,
  lerpFov,
  lockedRig,
  pickHotspot,
  EAST_CROP,
  floorLayout,
  stretchHotspots,
  viewGroundZ,
  wideShot,
  WIDE_MARGIN,
  type Hotspot,
} from './locked'
import { cameraModeFromSearch } from './mode'
import { TILT_DEG, VFOV_DEG, cornersOf, cropEast, defaultFraming, insetCorners, openingFraming, type Bounds, type Vec3 } from './math'

// The board the live app reports (frame included), as measured from the running dev server.
const BOARD: Bounds = { minX: -602, maxX: 598.97, minY: -5.46, maxY: 35.76, minZ: -528.9, maxZ: 601 }
// The stretched board (frame dropped, 1.679x wider) and its compass, as exported to Blender/Exports_wide.
// The board edge is a flat rim (y 0.65 to 2.57) far below the hills, which reach 35.76.
const RIM = 0.65
const WIDE: Bounds = { minX: -884.73, maxX: 911.15, minY: -0.5, maxY: 35.76, minZ: -482.25, maxZ: 543.98, rimY: RIM }
// The compass art has a transparent margin, so only the inner 90% of its quad has to stay in view.
const COMPASS = insetCorners(new Box3(new Vector3(-815, 1.9, -480), new Vector3(-625, 9.6, -290)), 0.1)
const deg = (rad: number) => (rad * 180) / Math.PI
const rad = (d: number) => (d * Math.PI) / 180
const centre = (b: Bounds) => defaultFraming(b, 1).target
const dist = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)

function camFor(rig: { position: Vec3; target: Vec3 }, vfov: number, aspect: number): PerspectiveCamera {
  const cam = new PerspectiveCamera(vfov, aspect, 1, 1e6)
  cam.position.set(rig.position.x, rig.position.y, rig.position.z)
  cam.quaternion.copy(aimQuaternion(rig.position, rig.target, 0))
  cam.updateMatrixWorld()
  cam.updateProjectionMatrix()
  return cam
}
function groundAt(cam: PerspectiveCamera, nx: number, ny: number, y: number): Vec3 {
  const dir = new Vector3(nx, ny, 0.5).unproject(cam).sub(cam.position).normalize()
  const t = (y - cam.position.y) / dir.y
  return { x: cam.position.x + dir.x * t, y, z: cam.position.z + dir.z * t }
}

describe('lockedRig', () => {
  const rig = lockedRig(WIDE, COMPASS)
  it('is the opening framing for a 16:9 window, so the locked and free cameras open on the same view', () => {
    const f = openingFraming(WIDE, VFOV_DEG, 16 / 9, COMPASS)
    expect(rig.position).toEqual(f.position)
    expect(rig.target).toEqual(f.target)
    expect(rig.distance).toBe(f.distance)
  })
  it('sits above and south of its target, TILT_DEG off straight down', () => {
    expect(rig.position.y).toBeGreaterThan(rig.target.y)
    expect(rig.position.z).toBeGreaterThan(rig.target.z)
    expect(deg(Math.atan2(rig.position.z - rig.target.z, rig.position.y - rig.target.y))).toBeCloseTo(TILT_DEG)
  })
  it('does not depend on the window: the same board always gives the same rig', () => {
    expect(lockedRig({ ...WIDE }, COMPASS)).toEqual(rig)
  })
})

describe('wideShot', () => {
  const rig = lockedRig(WIDE, COMPASS)
  const ASPECTS = [16 / 9, 1.9457, 2.2] // windows wide enough for the board to fill the screen with the compass in view
  const camOf = (aspect: number, mustSee: readonly Vec3[] = COMPASS) => {
    const shot = wideShot(WIDE, rig.position, aspect, mustSee)
    return { shot, cam: camFor({ position: rig.position, target: shot.target }, shot.fov, aspect) }
  }
  const ndcOf = (cam: PerspectiveCamera, p: Vec3) => new Vector3(p.x, p.y, p.z).project(cam)
  const rim = (x: number, z: number): Vec3 => ({ x, y: RIM, z })

  it('puts the north edge of the board exactly on the top edge of the screen', () => {
    for (const aspect of ASPECTS) {
      const { cam } = camOf(aspect)
      for (const x of [WIDE.minX, 0, WIDE.maxX]) expect(ndcOf(cam, rim(x, WIDE.minZ)).y).toBeCloseTo(1, 4)
    }
  })
  it('leaves no empty corners at the top: the far corners of the board are at or beyond the sides of the screen', () => {
    for (const aspect of ASPECTS) {
      const { cam } = camOf(aspect)
      expect(Math.abs(ndcOf(cam, rim(WIDE.minX, WIDE.minZ)).x)).toBeGreaterThanOrEqual(1 - 1e-4)
      expect(Math.abs(ndcOf(cam, rim(WIDE.maxX, WIDE.minZ)).x)).toBeGreaterThanOrEqual(1 - 1e-4)
    }
  })
  it('leaves no empty strip at the bottom: the south edge is at or below the bottom of the screen', () => {
    for (const aspect of ASPECTS) {
      const { cam } = camOf(aspect)
      for (const x of [WIDE.minX, 0, WIDE.maxX]) expect(ndcOf(cam, rim(x, WIDE.maxZ)).y).toBeLessThanOrEqual(-1 + 1e-4)
    }
  })
  it('is as wide as it can be: the far corners or the south edge sit exactly on the screen edge', () => {
    for (const aspect of ASPECTS) {
      const { cam } = camOf(aspect)
      const sideSlack = Math.abs(ndcOf(cam, rim(WIDE.maxX, WIDE.minZ)).x) - 1
      const bottomSlack = -1 - ndcOf(cam, rim(0, WIDE.maxZ)).y
      expect(Math.min(sideSlack, bottomSlack)).toBeCloseTo(0, 4)
    }
  })
  it('does not crop the far corners hard in a squarer window: the lens opens instead', () => {
    for (const aspect of [0.9, 1, 1.2, 1.5]) {
      const { cam } = camOf(aspect)
      expect(Math.abs(ndcOf(cam, rim(WIDE.maxX, WIDE.minZ)).x)).toBeLessThanOrEqual(1.08 + 1e-3)
    }
  })
  it('stays on the tripod: it aims straight along the camera north-south line, at the rim', () => {
    const { shot } = camOf(16 / 9)
    expect(shot.target.x).toBe(rig.position.x)
    expect(shot.target.y).toBe(RIM)
  })
  it('opens the lens for a narrower window so the board is not cropped sideways', () => {
    expect(camOf(1.2).shot.fov).toBeGreaterThan(camOf(2.2).shot.fov)
  })
  it('keeps every corner of the compass inside the wide shot for any window shape', () => {
    for (const aspect of [0.9, 1, 1.5, 16 / 9, 1.9457, 2.4]) {
      const { cam } = camOf(aspect)
      for (const corner of COMPASS) {
        const ndc = ndcOf(cam, corner)
        expect(Math.max(Math.abs(ndc.x), Math.abs(ndc.y))).toBeLessThanOrEqual(1 - WIDE_MARGIN + 1e-6)
      }
    }
  })
  it('opens the lens further for a squarer window, to keep the compass in view rather than crop it', () => {
    const withCompass = camOf(1.6)
    expect(withCompass.shot.fov).toBeGreaterThan(camOf(1.6, []).shot.fov)
    for (const corner of COMPASS) expect(Math.abs(ndcOf(withCompass.cam, corner).x)).toBeLessThanOrEqual(1 - WIDE_MARGIN + 1e-6)
  })
  it('keeps the tight shot when a point can never be brought inside (one on the north edge itself)', () => {
    const edge = [{ x: 0, y: RIM, z: WIDE.minZ }]
    expect(camOf(16 / 9, edge).shot.fov).toBeCloseTo(camOf(16 / 9, []).shot.fov, 6)
  })
  it('never opens past MAX_FOV_DEG, even for a sliver of a window', () => {
    expect(wideShot(WIDE, rig.position, 0.05, COMPASS).fov).toBe(MAX_FOV_DEG)
  })
})

describe('viewGroundZ', () => {
  const rig = lockedRig(WIDE, COMPASS)
  it('is where the top and the bottom of the screen meet the ground (the rim plane) in the wide shot', () => {
    for (const aspect of [16 / 9, 1.9457, 2.2]) {
      const shot = wideShot(WIDE, rig.position, aspect, COMPASS)
      const cam = camFor({ position: rig.position, target: shot.target }, shot.fov, aspect)
      const { far, near } = viewGroundZ(rig.position, shot, RIM)
      expect(far).toBeCloseTo(groundAt(cam, 0, 1, RIM).z, 3)
      expect(near).toBeCloseTo(groundAt(cam, 0, -1, RIM).z, 3)
    }
  })
  it('has the top of the screen on the north edge of the board, since the wide shot puts it there', () => {
    const shot = wideShot(WIDE, rig.position, 1.9457, COMPASS)
    expect(viewGroundZ(rig.position, shot, RIM).far).toBeCloseTo(WIDE.minZ, 1)
  })
})

describe('the opening view with the east of the board left out', () => {
  const view = cropEast(WIDE, EAST_CROP)
  const rig = lockedRig(view, COMPASS)
  const shotCam = (aspect: number) => {
    const shot = wideShot(view, rig.position, aspect, COMPASS)
    return camFor({ position: rig.position, target: shot.target }, shot.fov, aspect)
  }
  const ndcOf = (cam: PerspectiveCamera, x: number, z: number) => new Vector3(x, RIM, z).project(cam)

  it('leaves out the east part of the board: the camera moves west to the middle of what is kept', () => {
    expect(EAST_CROP).toBeGreaterThan(0)
    expect(view.maxX).toBeLessThan(WIDE.maxX)
    expect(rig.position.x).toBeCloseTo((view.minX + view.maxX) / 2)
    expect(rig.position.x).toBeLessThan(lockedRig(WIDE, COMPASS).position.x)
  })
  it('puts the cut line on the right edge of the screen and the west edge of the board on the left, along the top', () => {
    for (const aspect of [16 / 9, 1.9457, 2.2]) {
      const cam = shotCam(aspect)
      expect(ndcOf(cam, view.maxX, WIDE.minZ).x).toBeGreaterThanOrEqual(1 - 1e-4)
      expect(ndcOf(cam, view.minX, WIDE.minZ).x).toBeLessThanOrEqual(-1 + 1e-4)
      expect(ndcOf(cam, view.minX, WIDE.minZ).y).toBeCloseTo(1, 4)
    }
  })
  it('keeps the west of the board and the compass in view', () => {
    const cam = shotCam(1.9457)
    for (const corner of COMPASS) {
      const ndc = new Vector3(corner.x, corner.y, corner.z).project(cam)
      expect(Math.max(Math.abs(ndc.x), Math.abs(ndc.y))).toBeLessThanOrEqual(1 - WIDE_MARGIN + 1e-6)
    }
  })
})

describe('fitFov', () => {
  it('frames a sphere with the vertical field of view when the window is wide', () => {
    expect(fitFov(1000, 100, 2)).toBeCloseTo(deg(2 * Math.atan(0.1)))
  })
  it('uses the horizontal limit when the window is taller than wide', () => {
    expect(fitFov(1000, 100, 0.5)).toBeCloseTo(deg(2 * Math.atan(0.2)))
  })
  it('narrows as the subject gets smaller or farther', () => {
    expect(fitFov(1000, 50, 2)).toBeLessThan(fitFov(1000, 100, 2))
    expect(fitFov(2000, 100, 2)).toBeLessThan(fitFov(1000, 100, 2))
  })
})

describe('hotspotFov', () => {
  const rig = lockedRig(WIDE)
  const p = rig.position
  const wide = wideShot(WIDE, rig.position, 16 / 9).fov
  const at = (radius: number): Hotspot => ({ id: 'x', point: centre(WIDE), radius, hitRadius: 40, rollDeg: 0 })
  it('is tighter than the wide shot for a small subject', () => {
    expect(hotspotFov(p, at(60), 16 / 9, wide)).toBeLessThan(wide)
  })
  it('never zooms past MIN_FOV_DEG (the floor texture runs out of detail)', () => {
    expect(hotspotFov(p, at(0.001), 16 / 9, wide)).toBe(MIN_FOV_DEG)
  })
  it('never ends up wider than the wide shot', () => {
    expect(hotspotFov(p, at(1e6), 16 / 9, wide)).toBe(wide)
  })
})

describe('aimQuaternion', () => {
  const from = { x: 0, y: 1400, z: 800 }
  const to = { x: 193, y: 12, z: -277.5 }
  const forward = (q: Quaternion) => new Vector3(0, 0, -1).applyQuaternion(q)
  const right = (q: Quaternion) => new Vector3(1, 0, 0).applyQuaternion(q)
  const want = new Vector3(to.x - from.x, to.y - from.y, to.z - from.z).normalize()

  it('points the lens at the target', () => {
    expect(forward(aimQuaternion(from, to, 0)).angleTo(want)).toBeLessThan(1e-6)
  })
  it('keeps the horizon level with no roll', () => {
    expect(right(aimQuaternion(from, to, 0)).y).toBeCloseTo(0)
  })
  it('rolls about the lens axis: the target stays centred and the frame turns by exactly the roll', () => {
    const q = aimQuaternion(from, to, 3)
    expect(forward(q).angleTo(want)).toBeLessThan(1e-6)
    expect(deg(right(q).angleTo(right(aimQuaternion(from, to, 0))))).toBeCloseTo(3)
  })
  it('rolls the other way for a negative angle', () => {
    expect(Math.sign(right(aimQuaternion(from, to, 3)).y)).toBe(-Math.sign(right(aimQuaternion(from, to, -3)).y))
  })
})

describe('easeInOut', () => {
  it('starts at 0, ends at 1 and is halfway at the midpoint', () => {
    expect(easeInOut(0)).toBe(0)
    expect(easeInOut(1)).toBe(1)
    expect(easeInOut(0.5)).toBeCloseTo(0.5)
  })
  it('eases: slower than linear at the start, faster than linear at the end of the first half', () => {
    expect(easeInOut(0.1)).toBeLessThan(0.1)
    expect(easeInOut(0.9)).toBeGreaterThan(0.9)
  })
  it('never overshoots outside 0..1', () => {
    expect(easeInOut(-1)).toBe(0)
    expect(easeInOut(2)).toBe(1)
  })
  it('only ever increases', () => {
    let prev = -1
    for (let i = 0; i <= 20; i++) {
      const v = easeInOut(i / 20)
      expect(v).toBeGreaterThanOrEqual(prev)
      prev = v
    }
  })
})

describe('lerpFov', () => {
  it('hits both ends', () => {
    expect(lerpFov(23, 6, 0)).toBeCloseTo(23)
    expect(lerpFov(23, 6, 1)).toBeCloseTo(6)
  })
  it('zooms at a constant rate: the midpoint is the geometric mean, not the average', () => {
    expect(lerpFov(24, 6, 0.5)).toBeCloseTo(12)
  })
})

describe('pickHotspot', () => {
  const spot = (id: string, x: number, z: number, hitRadius = 40): Hotspot => ({
    id,
    point: { x, y: 0, z },
    radius: 60,
    hitRadius,
    rollDeg: 0,
  })
  const down = (x: number, z: number) => new Ray(new Vector3(x, 1000, z), new Vector3(0, -1, 0))

  it('returns the hotspot whose sphere the ray passes through', () => {
    expect(pickHotspot(down(10, 0), [spot('a', 0, 0), spot('b', 500, 0)])).toBe('a')
  })
  it('returns null for a ray that misses every sphere', () => {
    expect(pickHotspot(down(200, 200), [spot('a', 0, 0), spot('b', 500, 0)])).toBeNull()
  })
  it('uses each hotspot own hit radius', () => {
    expect(pickHotspot(down(60, 0), [spot('a', 0, 0, 40)])).toBeNull()
    expect(pickHotspot(down(60, 0), [spot('a', 0, 0, 80)])).toBe('a')
  })
  it('picks the nearest sphere along the ray when two overlap', () => {
    const high: Hotspot = { id: 'high', point: { x: 0, y: 300, z: 0 }, radius: 60, hitRadius: 40, rollDeg: 0 }
    expect(pickHotspot(down(0, 0), [spot('low', 0, 0), high])).toBe('high')
  })
  it('ignores a sphere behind the ray origin', () => {
    const behind = new Ray(new Vector3(0, 1000, 0), new Vector3(0, 1, 0))
    expect(pickHotspot(behind, [spot('a', 0, 0)])).toBeNull()
  })
})

describe('stretchHotspots', () => {
  const list: Hotspot[] = [
    { id: 'a', point: { x: -100, y: 8, z: 50 }, radius: 60, hitRadius: 40, rollDeg: 2 },
    { id: 'b', point: { x: 200, y: 20, z: -300 }, radius: 70, hitRadius: 45, rollDeg: -3 },
  ]
  it('moves each hotspot sideways with the stretched board and changes nothing else', () => {
    const s = stretchHotspots(list, 1.56)
    expect(s[0].point).toEqual({ x: -156, y: 8, z: 50 })
    expect(s[1].point).toEqual({ x: 312, y: 20, z: -300 })
    // the pieces are not stretched, so sizes, click targets and roll stay as authored
    expect(s.map(({ id, radius, hitRadius, rollDeg }) => ({ id, radius, hitRadius, rollDeg }))).toEqual(
      list.map(({ id, radius, hitRadius, rollDeg }) => ({ id, radius, hitRadius, rollDeg })),
    )
  })
  it('is the identity for a factor of 1 (the old, un-stretched floor)', () => {
    expect(stretchHotspots(list, 1)).toEqual(list)
  })
  it('adds the sideways shift the floor reports for a hotspot whose hill was moved, after the stretch', () => {
    const s = stretchHotspots(list, 1.56, { a: 40, unknown: 999 })
    expect(s[0].point.x).toBe(-156 + 40)
    expect(s[1].point.x).toBe(312)
  })
  it('does not modify the authored list', () => {
    stretchHotspots(list, 2)
    expect(list[0].point.x).toBe(-100)
  })
})

describe('floorLayout', () => {
  it('reads the stretch and the hotspot shifts the export wrote into the floor file', () => {
    expect(floorLayout({ stretchX: 1.679, hotspotShifts: { elgrillo: 68.3 } })).toEqual({ stretch: 1.679, shifts: { elgrillo: 68.3 } })
  })
  it('falls back to an un-stretched, un-shifted floor when the file says nothing', () => {
    expect(floorLayout(undefined)).toEqual({ stretch: 1, shifts: {} })
    expect(floorLayout({})).toEqual({ stretch: 1, shifts: {} })
  })
  it('ignores a stretch that is not a positive number and shifts that are not numbers', () => {
    expect(floorLayout({ stretchX: -2, hotspotShifts: { a: 'x', b: 5, c: null } })).toEqual({ stretch: 1, shifts: { b: 5 } })
    expect(floorLayout({ stretchX: 'wide', hotspotShifts: 7 })).toEqual({ stretch: 1, shifts: {} })
  })
})

describe('HOTSPOTS', () => {
  it('has unique ids', () => {
    expect(new Set(HOTSPOTS.map((h) => h.id)).size).toBe(HOTSPOTS.length)
  })
  it('includes Felipe Angeles artillery on the Vetagrande cannons', () => {
    const h = HOTSPOTS.find((s) => s.id === 'angeles-artillery')
    expect(h).toBeDefined()
    expect(h!.point.x).toBeGreaterThan(157)
    expect(h!.point.x).toBeLessThan(229)
    expect(h!.point.z).toBeCloseTo(-277.5, 0)
  })
  it("includes Villa's camp with his train in the north-west of the board", () => {
    const h = HOTSPOTS.find((s) => s.id === 'villa-train')
    expect(h).toBeDefined()
    expect(h!.point.x).toBeLessThan(-300) // west
    expect(h!.point.z).toBeLessThan(-100) // north
  })
  it('keeps every hotspot on the board with a sane radius and only a slight roll', () => {
    for (const h of HOTSPOTS) {
      expect(h.point.x).toBeGreaterThan(BOARD.minX)
      expect(h.point.x).toBeLessThan(BOARD.maxX)
      expect(h.point.z).toBeGreaterThan(BOARD.minZ)
      expect(h.point.z).toBeLessThan(BOARD.maxZ)
      expect(h.radius).toBeGreaterThan(0)
      expect(h.hitRadius).toBeGreaterThan(0)
      expect(Math.abs(h.rollDeg)).toBeLessThanOrEqual(5)
    }
  })
})

describe('keeping a focused frame on the board', () => {
  // Exactly what the app does: the tripod of the cropped view, the hotspots on the stretched board.
  const rig = lockedRig(cropEast(WIDE, EAST_CROP), COMPASS)
  const hotspots = stretchHotspots(HOTSPOTS, 1.679, { elgrillo: 68.3 })
  const ASPECTS = [16 / 9, 1.9457, 2.2, 1.3]
  const wideFov = (aspect: number) => wideShot(cropEast(WIDE, EAST_CROP), rig.position, aspect, COMPASS).fov
  const cornersOnRim = (h: Hotspot, aspect: number) => {
    const shot = hotspotShot(rig.position, h, aspect, wideFov(aspect), WIDE)
    const cam = new PerspectiveCamera(shot.fov, aspect, 1, 1e6)
    cam.position.set(rig.position.x, rig.position.y, rig.position.z)
    cam.quaternion.copy(shot.quat)
    cam.updateMatrixWorld()
    cam.updateProjectionMatrix()
    return [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([nx, ny]) => groundAt(cam, nx, ny, RIM))
  }

  it('shows no background in any hotspot shot, in any window shape: every corner of the frame is on the board', () => {
    for (const h of hotspots) {
      for (const aspect of ASPECTS) {
        for (const c of cornersOnRim(h, aspect)) {
          const label = `${h.id} @ ${aspect.toFixed(2)}`
          expect(c.x, label).toBeGreaterThanOrEqual(WIDE.minX + EDGE_MARGIN - 0.05)
          expect(c.x, label).toBeLessThanOrEqual(WIDE.maxX - EDGE_MARGIN + 0.05)
          expect(c.z, label).toBeGreaterThanOrEqual(WIDE.minZ + EDGE_MARGIN - 0.05)
          expect(c.z, label).toBeLessThanOrEqual(WIDE.maxZ - EDGE_MARGIN + 0.05)
        }
      }
    }
  })
  it('moves the cannons shot south, away from the north rim it used to show', () => {
    const h = hotspots.find((s) => s.id === 'angeles-artillery')!
    const fov = hotspotFov(rig.position, h, 16 / 9, wideFov(16 / 9))
    const aim = keepOnBoard(rig.position, h.point, h.rollDeg, fov, 16 / 9, WIDE)
    expect(aim.z).toBeGreaterThan(h.point.z + 1)
    expect(aim.z - h.point.z).toBeLessThan(h.radius) // a nudge: the cannons stay well inside the frame
    expect(aim.x).toBeCloseTo(h.point.x, 0)
    expect(aim.y).toBe(h.point.y)
  })
  it('leaves a shot that already fits exactly where the hotspot is', () => {
    const h = hotspots.find((s) => s.id === 'cathedral')!
    const fov = hotspotFov(rig.position, h, 16 / 9, wideFov(16 / 9))
    expect(keepOnBoard(rig.position, h.point, h.rollDeg, fov, 16 / 9, WIDE)).toEqual(h.point)
  })
  it('does not modify the hotspot it is given', () => {
    const h = { ...hotspots[0], point: { ...hotspots[0].point } }
    hotspotShot(rig.position, h, 16 / 9, wideFov(16 / 9), WIDE)
    expect(h).toEqual(hotspots[0])
  })
})

describe('cameraModeFromSearch', () => {
  it('defaults to the locked camera: the user gets the fixed view', () => {
    expect(cameraModeFromSearch('')).toBe('locked')
    expect(cameraModeFromSearch('?foo=1')).toBe('locked')
  })
  it('switches to the free camera with ?cam=free, wherever it appears', () => {
    expect(cameraModeFromSearch('?cam=free')).toBe('free')
    expect(cameraModeFromSearch('?foo=1&cam=free')).toBe('free')
  })
  it('treats anything else as locked', () => {
    expect(cameraModeFromSearch('?cam=locked')).toBe('locked')
    expect(cameraModeFromSearch('?cam=bogus')).toBe('locked')
  })
})
