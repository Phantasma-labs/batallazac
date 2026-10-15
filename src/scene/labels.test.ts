import { describe, expect, it } from 'vitest'
import { PINS } from './places'
import { GROUND_FADE, KICKER_RATIO, LABELS, MAX_LABEL_BOOST, MAX_TURN, PIN_GAP, REF_PX_PER_UNIT, REF_WIDE_FOV, WORD_GAP, capFraction, groundTextAlpha, labelBoost, labelCenter, labelGrid, layoutLine, pxPerUnit, ridgeAngle } from './labels'

describe('label data', () => {
  it('has one label per pin and no strangers', () => {
    expect(LABELS.map((l) => l.id).sort()).toEqual(PINS.map((p) => p.id).sort())
  })
  it('spells the pin name: the small line and the name read as the pin label', () => {
    for (const pin of PINS) {
      const l = LABELS.find((x) => x.id === pin.id)!
      expect([l.kicker, l.name].filter(Boolean).join(' ').toLowerCase()).toBe(pin.label.toLowerCase())
    }
  })
  it('makes the hills bigger than the town', () => {
    const cap = (id: string) => LABELS.find((l) => l.id === id)!.cap
    for (const hill of ['elgrillo', 'sierpe', 'labufa', 'vetagrande']) expect(cap(hill)).toBeGreaterThan(cap('centro'))
  })
  it('keeps the size tiers fixed: the hills larger, the town clearly smaller', () => {
    const cap = (id: string) => LABELS.find((l) => l.id === id)!.cap
    for (const l of LABELS.filter((x) => x.id !== 'centro')) expect(l.cap).toBeGreaterThan(cap('centro') * 1.15)
  })
  it('keeps the names modest: a hill name is not much longer than a few hundred units', () => {
    for (const l of LABELS.filter((x) => x.id !== 'toma')) expect(l.name.length * (0.74 + l.tracking) * (l.cap / 0.68)).toBeLessThan(330) // the title is not a place name
  })
  it('makes the name twice as tall as the small line above it', () => {
    expect(KICKER_RATIO).toBe(0.5)
  })
})

describe('layout of a line', () => {
  const measure = (s: string) => 10 * s.length
  it('puts each letter after the previous one plus the tracking, none after the last', () => {
    const { glyphs, width } = layoutLine('ABC', 20, 0.5, measure)
    expect(glyphs.map((g) => g.x)).toEqual([0, 20, 40])
    expect(width).toBe(10 + 10 + 10 + 2 * 10)
  })
  it('widens the gap after a space', () => {
    const { glyphs } = layoutLine('A B', 20, 0, measure)
    expect(glyphs[2].x - glyphs[1].x).toBe(10 + WORD_GAP * 20)
  })
  it('handles an empty line', () => {
    expect(layoutLine('', 20, 0.5, measure)).toEqual({ glyphs: [], width: 0 })
  })
})

describe('label grid', () => {
  const g = labelGrid({ x: 100, z: 50 }, 80, 20, 0, 10)
  it('covers the label with cols x rows cells', () => {
    expect([g.cols, g.rows]).toEqual([8, 2])
    expect(g.xz).toHaveLength((8 + 1) * (2 + 1) * 2)
    expect(g.index).toHaveLength(8 * 2 * 6)
  })
  it('is centred on the point, reading along +x with the top of the letters to the north at angle 0', () => {
    expect([g.xz[0], g.xz[1]]).toEqual([60, 60]) // left end, bottom edge of the letters: south of the middle
    expect([g.uv[0], g.uv[1]]).toEqual([0, 0])
    const last = g.xz.length - 2
    expect([g.xz[last], g.xz[last + 1]]).toEqual([140, 40]) // right end, top edge: north (smaller z)
    expect([g.uv[last], g.uv[last + 1]]).toEqual([1, 1])
  })
  it('faces its triangles up', () => {
    const p = (i: number) => ({ x: g.xz[i * 2], z: g.xz[i * 2 + 1] })
    for (let t = 0; t < g.index.length; t += 3) {
      const a = p(g.index[t])
      const b = p(g.index[t + 1])
      const c = p(g.index[t + 2])
      // The y of (b - a) x (c - a) for points on the ground: positive faces up.
      const ny = (b.z - a.z) * (c.x - a.x) - (b.x - a.x) * (c.z - a.z)
      expect(ny).toBeGreaterThan(0)
    }
  })
  it('turns on the ground: a quarter turn makes the line run toward +z', () => {
    const q = labelGrid({ x: 0, z: 0 }, 80, 20, 90, 10)
    const last = q.cols
    expect(q.xz[last * 2]).toBeCloseTo(-10) // the right end of the bottom edge: 40 on toward +z, 10 off to the west
    expect(q.xz[last * 2 + 1]).toBeCloseTo(40)
  })
})

describe('placement and fading', () => {
  it('hangs the text straight below the pin, centred: its top edge is `PIN_GAP` south of it', () => {
    const c = labelCenter({ x: 100, z: 200 }, 60)
    expect(c).toEqual({ x: 100, z: 200 + PIN_GAP + 30 })
  })
  it('can shift the text sideways, off a hill it would lie over, without moving it up or down', () => {
    expect(labelCenter({ x: 100, z: 200 }, 60, -55)).toEqual({ x: 45, z: 200 + PIN_GAP + 30 })
    expect(labelCenter({ x: 100, z: 200 }, 60, 0, 100)).toEqual({ x: 100, z: 200 + PIN_GAP + 30 - 100 }) // north is -z
    expect(LABELS.filter((l) => l.id !== 'sierpe' && l.id !== 'loreto').every((l) => l.shift === undefined)).toBe(true)
  })
  it('keeps every label clear of every other label and of every other place, on the wide-shot board', () => {
    // Rough footprints (width from the letters, height from the caps) of each label below its place at these board positions.
    const at: Record<string, { x: number; z: number }> = {
      vetagrande: { x: 193, z: -277 },
      elgrillo: { x: -346, z: 103 },
      sierpe: { x: -374, z: -12 },
      loreto: { x: 79, z: -65 },
      labufa: { x: 222, z: 18 },
      centro: { x: -50, z: 95 },
      toma: { x: -450, z: -370 },
    }
    const box = (l: (typeof LABELS)[number]) => {
      // At the largest enlargement a small window gives (see `labelBoost`): the worst case for overlap.
      const width = l.name.length * (0.74 + l.tracking) * (l.cap / 0.68) * MAX_LABEL_BOOST
      const height = l.cap * (l.kicker ? 1.5 + 0.44 * 0.5 : 1) * MAX_LABEL_BOOST
      const c = labelCenter(at[l.id], height, l.shift, l.rise)
      // A turn of up to MAX_TURN degrees swings the ends by this much.
      const swing = (width / 2) * Math.sin((MAX_TURN * Math.PI) / 180)
      return { l, x0: c.x - width / 2, x1: c.x + width / 2, z0: c.z - height / 2 - swing, z1: c.z + height / 2 + swing }
    }
    const boxes = LABELS.map(box)
    for (const a of boxes) for (const b of boxes) {
      if (a.l.id >= b.l.id) continue
      const overlap = a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1
      expect(overlap, `${a.l.id} overlaps ${b.l.id}`).toBe(false)
    }
    // No label runs over another place's spot.
    for (const a of boxes) for (const [id, p] of Object.entries(at)) {
      if (id === a.l.id) continue
      const under = p.x > a.x0 - 10 && p.x < a.x1 + 10 && a.z1 > p.z - 40 && a.z0 < p.z + 12
      expect(under, `${a.l.id} runs over the spot of ${id}`).toBe(false)
    }
  })
  it('shows the ground text while small and loses it as it swells', () => {
    expect(groundTextAlpha(0.015)).toBe(1)
    expect(groundTextAlpha(GROUND_FADE.start)).toBe(1)
    expect(groundTextAlpha(GROUND_FADE.end)).toBe(0)
    expect(groundTextAlpha(0.25)).toBe(0)
    const mid = groundTextAlpha((GROUND_FADE.start + GROUND_FADE.end) / 2)
    expect(mid).toBeGreaterThan(0.4)
    expect(mid).toBeLessThan(0.6)
  })
  it('sees a label bigger as the lens narrows or the camera nears', () => {
    const base = capFraction(30, 1800, REF_WIDE_FOV, REF_WIDE_FOV)
    expect(capFraction(30, 1800, REF_WIDE_FOV / 2, REF_WIDE_FOV)).toBeGreaterThan(base * 1.9)
    expect(capFraction(30, 900, REF_WIDE_FOV, REF_WIDE_FOV)).toBeCloseTo(base * 2, 1)
  })
  it('reads the same in a window of another shape, whose wide shot has another lens', () => {
    const reference = capFraction(30, 1800, 23.1, REF_WIDE_FOV)
    const ultrawide = capFraction(30, 1800, 17, 17)
    expect(ultrawide).toBeCloseTo(reference, 1)
  })
  it('shows the wide-shot labels in full', () => {
    // A hill at the wide shot's distance, for a lens of 23.1 degrees: about 0.02 of the viewport height.
    for (const l of LABELS) expect(groundTextAlpha(capFraction(l.fadeCap ?? l.cap, 1800, 23.1, 23.1))).toBe(1)
  })
  it('stays mostly there in a medium shot (a lens 1.6 times closer), and has gone in a true close-up', () => {
    for (const l of LABELS) expect(groundTextAlpha(capFraction(l.fadeCap ?? l.cap, 1800, 14.4, 23.1))).toBeGreaterThan(0.8)
    for (const l of LABELS) expect(groundTextAlpha(capFraction(l.fadeCap ?? l.cap, 1800, 6.5, 23.1))).toBeLessThan(0.05)
  })
  it('measures the board in pixels per world unit with the true projection', () => {
    // 2 * 1000 * tan(15 deg) = 535.9 world units seen across a 536 px high view: one pixel each.
    expect(pxPerUnit(1000, 30, 536)).toBeCloseTo(1, 2)
    expect(pxPerUnit(500, 30, 536)).toBeCloseTo(2, 2)
  })
  it('keeps the names as they are on the reference window and on anything larger', () => {
    expect(labelBoost(REF_PX_PER_UNIT)).toBe(1)
    expect(labelBoost(1.4)).toBe(1)
    expect(labelBoost(10)).toBe(1)
  })
  it('enlarges the names on a smaller window, so they are as big on screen as on the reference one', () => {
    const scale = REF_PX_PER_UNIT * 0.8 // a board at 0.8 of the reference size on screen
    expect(labelBoost(scale)).toBeCloseTo(1.25, 6)
    expect(labelBoost(scale) * scale).toBeCloseTo(REF_PX_PER_UNIT, 6)
    expect(labelBoost(0.5)).toBeGreaterThan(labelBoost(0.8))
  })
  it('stops enlarging at a limit, and ignores a bad scale', () => {
    expect(labelBoost(0.01)).toBe(MAX_LABEL_BOOST)
    expect(labelBoost(0)).toBe(MAX_LABEL_BOOST)
    expect(labelBoost(NaN)).toBe(1)
    expect(labelBoost(Infinity)).toBe(1)
  })
  it('falls monotonically with size', () => {
    let last = 1
    for (let f = 0.015; f < 0.06; f += 0.0025) {
      const a = groundTextAlpha(f)
      expect(a).toBeLessThanOrEqual(last)
      last = a
    }
  })
})

describe('ridge angle', () => {
  /** High ground along a ridge that runs at `deg` on the ground (positive toward +z): a long thin hump. */
  const ridge = (deg: number, length = 90, width = 28) => {
    const a = (deg * Math.PI) / 180
    return (x: number, z: number) => {
      const along = x * Math.cos(a) + z * Math.sin(a)
      const across = -x * Math.sin(a) + z * Math.cos(a)
      return 30 * Math.exp(-((along / length) ** 2 + (across / width) ** 2))
    }
  }
  it('is zero on flat ground and on a round hill', () => {
    expect(ridgeAngle(() => 5, 0, 0)).toBe(0)
    expect(ridgeAngle((x, z) => 30 * Math.exp(-(x * x + z * z) / 2500), 0, 0)).toBe(0)
  })
  it('leans toward the ridge: the sign of its direction, softened', () => {
    const up = ridgeAngle(ridge(-20), 0, 0)
    const down = ridgeAngle(ridge(20), 0, 0)
    expect(up).toBeLessThan(-3)
    expect(down).toBeGreaterThan(3)
    expect(Math.abs(up)).toBeLessThan(20)
    expect(up).toBeCloseTo(-down, 1)
  })
  it('never turns the text more than MAX_TURN, and reads a ridge across the page as the same line', () => {
    expect(Math.abs(ridgeAngle(ridge(60), 0, 0))).toBeLessThanOrEqual(MAX_TURN)
    expect(Math.abs(ridgeAngle(ridge(-80), 0, 0))).toBeLessThanOrEqual(MAX_TURN)
    // A ridge at 170 degrees is the one at -10 read the other way.
    expect(ridgeAngle(ridge(170), 0, 0)).toBeCloseTo(ridgeAngle(ridge(-10), 0, 0), 1)
  })
  it('measures round the given centre, not the origin', () => {
    const g = ridge(15)
    expect(ridgeAngle((x, z) => g(x - 400, z + 250), 400, -250)).toBeCloseTo(ridgeAngle(g, 0, 0), 5)
  })
})
