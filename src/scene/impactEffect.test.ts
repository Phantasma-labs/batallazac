import { describe, expect, it } from 'vitest'
import { EXPLOSION, MAX_SHELLS, SHELL, VOLLEY, WIND, blastLook, effectUnit, flicker, flashLevel, hash01, muzzleLevel, puffAt, puffLook, rifleFlash, ringLook, seedOf, shellAt } from './impactEffect'

describe('hash01 and seedOf', () => {
  it('are repeatable and stay in range', () => {
    for (let i = 0; i < 50; i++) {
      const h = hash01(i * 1.7)
      expect(h).toBeGreaterThanOrEqual(0)
      expect(h).toBeLessThan(1)
      expect(hash01(i * 1.7)).toBe(h)
    }
  })
  it('seed attacks differently', () => {
    expect(seedOf('angeles-flag>labufa')).toBe(seedOf('angeles-flag>labufa'))
    expect(seedOf('angeles-flag>labufa')).not.toBe(seedOf('angeles-flag>elgrillo'))
  })
})

describe('shellAt', () => {
  it('is a pure function of its inputs', () => {
    expect(shellAt(SHELL, 1, 12.3, 5)).toEqual(shellAt(SHELL, 1, 12.3, 5))
  })
  it('flies for `flight` seconds after each launch, then has landed', () => {
    // Find a launch by scanning for the start of a cycle.
    let t = 0
    while (shellAt(SHELL, 0, t, 3).phase > 0.01 || t < 1) t += 0.001
    const launch = shellAt(SHELL, 0, t, 3)
    expect(launch.flying).toBe(true)
    expect(launch.flight).toBeCloseTo(0, 1)
    const mid = shellAt(SHELL, 0, t + SHELL.flight / 2, 3)
    expect(mid.flying).toBe(true)
    expect(mid.flight).toBeGreaterThan(0.4)
    expect(mid.flight).toBeLessThan(0.6)
    expect(mid.since).toBeLessThan(0)
    const landed = shellAt(SHELL, 0, t + SHELL.flight + 0.2, 3)
    expect(landed.flying).toBe(false)
    expect(landed.since).toBeCloseTo(0.2, 1)
    expect(landed.cycle).toBe(launch.cycle)
  })
  it('lands where the tracer was heading: the landing point is fixed for the whole flight', () => {
    const a = shellAt(SHELL, 2, 20.0, 9)
    const t0 = 20.0 - a.phase
    const b = shellAt(SHELL, 2, t0 + SHELL.flight - 0.001, 9)
    const c = shellAt(SHELL, 2, t0 + SHELL.flight + 0.3, 9)
    expect(b.scatter).toEqual(c.scatter)
    expect(b.cycle).toBe(c.cycle)
  })
  it('lands within the scatter radius and somewhere else each cycle', () => {
    const seen = new Set<string>()
    for (let c = 0; c < 8; c++) {
      const sh = shellAt(SHELL, 0, c * SHELL.period + 0.5, 4)
      expect(Math.hypot(sh.scatter.x, sh.scatter.z)).toBeLessThanOrEqual(SHELL.scatter + 1e-9)
      seen.add(`${sh.scatter.x.toFixed(3)},${sh.scatter.z.toFixed(3)}`)
    }
    expect(seen.size).toBeGreaterThan(5)
  })
  it('staggers the slots through the period', () => {
    const offsets = Array.from({ length: SHELL.shells }, (_, k) => shellAt(SHELL, k, 0, 2).phase)
    expect(new Set(offsets.map((v) => v.toFixed(3))).size).toBe(SHELL.shells)
  })
  it('never flies when the flash is instant (a rifle volley)', () => {
    for (let t = 0; t < 5; t += 0.1) expect(shellAt(VOLLEY, 0, t, 1).flying).toBe(false)
  })
})

describe('flashes and rings', () => {
  it('flash is dark before the landing, full at it, and gone within half a second', () => {
    expect(flashLevel(-0.1)).toBe(0)
    expect(flashLevel(0)).toBe(1)
    expect(flashLevel(0.5)).toBeLessThan(0.02)
  })
  it('muzzle flash is shorter than the flash on the target', () => {
    expect(muzzleLevel(0.2)).toBeLessThan(flashLevel(0.2))
    expect(muzzleLevel(-1)).toBe(0)
  })
  it('the ring spreads and fades', () => {
    expect(ringLook(-1)).toEqual({ spread: 0, alpha: 0 })
    expect(ringLook(0.5).spread).toBeGreaterThan(ringLook(0.1).spread)
    expect(ringLook(0.5).alpha).toBeLessThan(ringLook(0.1).alpha)
    expect(ringLook(5).alpha).toBe(0)
  })
})

describe('smoke', () => {
  it('puffs are staggered and cycle through their life', () => {
    const ages = Array.from({ length: 8 }, (_, i) => puffAt(i, 8, 0, 1).age)
    expect(new Set(ages.map((a) => a.toFixed(3))).size).toBe(8)
    for (const a of ages) {
      expect(a).toBeGreaterThanOrEqual(0)
      expect(a).toBeLessThan(1)
    }
    const a = puffAt(3, 8, 0, 1), b = puffAt(3, 8, 3.4, 1)
    expect(b.age).toBeCloseTo(a.age, 6)
    expect(b.cycle).toBe(a.cycle + 1)
  })
  it('fades in, thins out, swells and rises', () => {
    expect(puffLook(0).alpha).toBe(0)
    expect(puffLook(1).alpha).toBe(0)
    expect(puffLook(0.15).alpha).toBeGreaterThan(0.5)
    expect(puffLook(0.9).alpha).toBeLessThan(puffLook(0.3).alpha)
    expect(puffLook(0.8).size).toBeGreaterThan(puffLook(0.2).size)
    expect(puffLook(0.8).rise).toBeGreaterThan(puffLook(0.2).rise)
  })
  it('holds a dense mass before it thins, and is blown downwind a little more as it ages', () => {
    expect(puffLook(0.3).alpha).toBeCloseTo(1, 1)
    expect(puffLook(0.6).alpha).toBeLessThan(puffLook(0.3).alpha)
    expect(puffLook(0.8).drift).toBeGreaterThan(puffLook(0.2).drift)
    expect(puffLook(1).size).toBeGreaterThan(2.4)
  })
  it('is lit from inside by the fire only while young', () => {
    expect(puffLook(0).warm).toBe(1)
    expect(puffLook(0.2).warm).toBeCloseTo(0.5)
    expect(puffLook(0.5).warm).toBe(0)
  })
  it('blows toward the north-east: east (+x) and north (-z)', () => {
    expect(WIND.x).toBeGreaterThan(0)
    expect(WIND.z).toBeLessThan(0)
    expect(Math.hypot(WIND.x, WIND.z)).toBeCloseTo(1, 1)
  })
  it('the fire flickers within a narrow band', () => {
    for (let t = 0; t < 10; t += 0.07) {
      expect(flicker(t, 3)).toBeGreaterThan(0.75)
      expect(flicker(t, 3)).toBeLessThanOrEqual(1)
    }
  })
})

describe('effectUnit', () => {
  it('is a fixed number of pixels until clamped', () => {
    expect(effectUnit(0.5, 40)).toBeCloseTo(20)
    expect(effectUnit(1000)).toBe(58)
    expect(effectUnit(0.0001)).toBe(17)
  })
})

describe('the explosion', () => {
  it('is a bigger, smokier burst than an artillery strike, with no tracers, and fits the ground shader', () => {
    expect(EXPLOSION.plume).toBeGreaterThan(SHELL.plume)
    expect(EXPLOSION.puffs).toBeGreaterThan(SHELL.puffs)
    expect(EXPLOSION.tracers).toBe(false)
    expect(EXPLOSION.shells).toBeLessThanOrEqual(MAX_SHELLS)
  })
  it('blooms at once, then cools, and nothing is there before the bang', () => {
    expect(blastLook(-1)).toEqual({ bloom: 0, spread: 0, ring: 0 })
    expect(blastLook(0).bloom).toBe(0)
    const peak = blastLook(0.5).bloom
    expect(peak).toBeGreaterThan(0.7)
    expect(blastLook(3).bloom).toBeLessThan(peak)
    expect(blastLook(20).bloom).toBeLessThan(0.05)
  })
  it('sends a shock ring out that spreads and fades away', () => {
    expect(blastLook(1).spread).toBeLessThan(blastLook(6).spread)
    expect(blastLook(30).spread).toBeGreaterThan(0.95)
    expect(blastLook(1).ring).toBeGreaterThan(0.6)
    expect(blastLook(15).ring).toBe(0)
  })
})

describe('rifleFlash', () => {
  const sample = (rifle: number, seed: number, seconds = 60, step = 1 / 60) => Array.from({ length: Math.round(seconds / step) }, (_, i) => rifleFlash(rifle, i * step, seed))
  it('is repeatable and stays between 0 and 1', () => {
    for (const v of sample(0, 5, 20)) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    }
    expect(rifleFlash(1, 7.25, 3)).toBe(rifleFlash(1, 7.25, 3))
  })
  it('flashes about once a period, in short bursts: dark most of the time', () => {
    const v = sample(0, 5, 60)
    let rises = 0
    for (let i = 1; i < v.length; i++) if (v[i] > 0.5 && v[i - 1] <= 0.5) rises++
    expect(rises).toBeGreaterThan(60 / 1.3 - 6)
    expect(rises).toBeLessThan(60 / 1.3 + 6)
    expect(v.filter((x) => x > 0.2).length / v.length).toBeLessThan(0.15)
  })
  it('fades within a fraction of a second after the flash', () => {
    const v = sample(0, 5, 10, 0.005)
    const peak = v.findIndex((x, i) => x > 0.9 && v[i - 1] < x)
    expect(peak).toBeGreaterThan(-1)
    expect(v[peak + 60]).toBeLessThan(0.05) // 0.3 s later
  })
  it('keeps the soldiers of a group, and two groups, out of step', () => {
    const a = sample(0, 5, 10), b = sample(1, 5, 10), c = sample(0, 9, 10)
    const differ = (x: number[], y: number[]) => x.filter((v, i) => Math.abs(v - y[i]) > 0.3).length
    expect(differ(a, b)).toBeGreaterThan(20)
    expect(differ(a, c)).toBeGreaterThan(20)
  })
})
