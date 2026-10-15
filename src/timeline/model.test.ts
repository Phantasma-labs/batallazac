import { describe, expect, it } from 'vitest'
import {
  DAY_END,
  DAY_START,
  activeAttacks,
  activeBlasts,
  activeShotEvent,
  formatClock,
  hm,
  latestEvent,
  marchProgress,
  nextEvent,
  pathLength,
  pointAlong,
  previousEvent,
  unitPosition,
  type ResolvedMarch,
  type TimelineEvent,
} from './model'

const p = (x: number, y = 0, z = 0) => ({ x, y, z })
const ev = (id: string, track: 'angeles' | 'villa' | 'federal', time: number, extra: Partial<TimelineEvent> = {}): TimelineEvent => ({
  id,
  track,
  time,
  title: { es: id, en: id },
  text: { es: '', en: '' },
  source: 'sourced',
  ...extra,
})

describe('clock text', () => {
  it('formats minutes after midnight', () => {
    expect(hm(10, 5)).toBe(605)
    expect(formatClock(hm(10, 5))).toBe('10:05')
    expect(formatClock(hm(9, 30))).toBe('09:30')
    expect(formatClock(hm(18))).toBe('18:00')
    expect(formatClock(605.4)).toBe('10:05')
  })
  it('runs from 00:00 to 20:00', () => {
    expect(formatClock(DAY_START)).toBe('00:00')
    expect(formatClock(DAY_END)).toBe('20:00')
  })
})

describe('paths', () => {
  const path = [p(0), p(10), p(10, 0, 10)]
  it('measures a polyline', () => {
    expect(pathLength(path)).toBe(20)
  })
  it('walks it by length', () => {
    expect(pointAlong(path, 0)).toEqual(p(0))
    expect(pointAlong(path, 0.25)).toEqual(p(5))
    expect(pointAlong(path, 0.5)).toEqual(p(10))
    expect(pointAlong(path, 0.75)).toEqual(p(10, 0, 5))
    expect(pointAlong(path, 1)).toEqual(p(10, 0, 10))
  })
  it('clamps the fraction and handles one point', () => {
    expect(pointAlong(path, -1)).toEqual(p(0))
    expect(pointAlong(path, 2)).toEqual(p(10, 0, 10))
    expect(pointAlong([p(3)], 0.5)).toEqual(p(3))
  })
  it('rejects an empty path', () => {
    expect(() => pointAlong([], 0.5)).toThrow()
  })
})

describe('marches', () => {
  const m = (unit: string, start: number, end: number, ...xs: number[]): ResolvedMarch => ({ unit, start, end, path: xs.map((x) => p(x)) })
  it('progresses at constant speed and clamps', () => {
    const x = m('u', 100, 200, 0, 10)
    expect(marchProgress(x, 50)).toBe(0)
    expect(marchProgress(x, 150)).toBe(0.5)
    expect(marchProgress(x, 300)).toBe(1)
  })
  it('a zero-length march is done at its time', () => {
    const x = m('u', 100, 100, 0, 10)
    expect(marchProgress(x, 99)).toBe(0)
    expect(marchProgress(x, 100)).toBe(1)
  })
  it('puts a unit at its start, along a march, and where the last march ended', () => {
    const marches = [m('u', 100, 200, 0, 10), m('u', 300, 400, 10, 30), m('other', 0, 1000, 500, 600)]
    expect(unitPosition(p(0), marches, 'u', 50)).toEqual(p(0))
    expect(unitPosition(p(0), marches, 'u', 150)).toEqual(p(5))
    expect(unitPosition(p(0), marches, 'u', 250)).toEqual(p(10))
    expect(unitPosition(p(0), marches, 'u', 350)).toEqual(p(20))
    expect(unitPosition(p(0), marches, 'u', 999)).toEqual(p(30))
  })
  it('scrubbing back walks a unit back', () => {
    const marches = [m('u', 100, 200, 0, 10)]
    expect(unitPosition(p(0), marches, 'u', 180).x).toBeCloseTo(8)
    expect(unitPosition(p(0), marches, 'u', 120).x).toBeCloseTo(2)
  })
})

describe('events', () => {
  const events = [
    ev('a', 'angeles', 600, { shot: 'one' }),
    ev('b', 'villa', 605),
    ev('c', 'villa', 660, { shot: 'two' }),
    ev('d', 'angeles', 660, { shot: 'three' }),
  ]
  it('the camera follows the latest event that names a shot, the later written one on a tie', () => {
    expect(activeShotEvent(events, 590)).toBeNull()
    expect(activeShotEvent(events, 600)?.id).toBe('a')
    expect(activeShotEvent(events, 620)?.id).toBe('a')
    expect(activeShotEvent(events, 660)?.id).toBe('d')
    expect(activeShotEvent(events, 1000)?.id).toBe('d')
  })
  it('finds the latest event of a lane', () => {
    expect(latestEvent(events, 'villa', 604)).toBeNull()
    expect(latestEvent(events, 'villa', 610)?.id).toBe('b')
    expect(latestEvent(events, 'angeles', 700)?.id).toBe('d')
  })
  it('finds the neighbours of a time', () => {
    expect(nextEvent(events, 600)?.id).toBe('b')
    expect(nextEvent(events, 700)).toBeNull()
    expect(previousEvent(events, 660)?.id).toBe('b')
    expect(previousEvent(events, 600)).toBeNull()
  })
})

describe('attacks', () => {
  const events = [ev('a', 'angeles', 100, { attacks: [{ unit: 'u', target: 't', endTime: 200 }] })]
  it('shows between its times and fades at the ends', () => {
    expect(activeAttacks(events, 99)).toHaveLength(0)
    expect(activeAttacks(events, 201)).toHaveLength(0)
    expect(activeAttacks(events, 100)[0].strength).toBe(0)
    expect(activeAttacks(events, 105)[0].strength).toBe(0.5)
    expect(activeAttacks(events, 150)[0].strength).toBe(1)
    expect(activeAttacks(events, 195)[0].strength).toBe(0.5)
  })
  it('can start later than its event, and then fades in from its own start', () => {
    const later = [ev('a', 'angeles', 100, { attacks: [{ unit: 'u', target: 't', startTime: 130, endTime: 200 }] })]
    expect(activeAttacks(later, 129)).toHaveLength(0)
    expect(activeAttacks(later, 130)[0].strength).toBe(0)
    expect(activeAttacks(later, 130)[0].start).toBe(130)
    expect(activeAttacks(later, 135)[0].strength).toBe(0.5)
    expect(activeAttacks(later, 195)[0].strength).toBe(0.5)
  })
})

describe('blasts', () => {
  const events = [ev('b', 'villa', 1140, { blasts: [{ at: 'centro', endTime: 1170 }] })]
  it('go off at once, last until their end and fade out over the last minutes', () => {
    expect(activeBlasts(events, 1139)).toHaveLength(0)
    expect(activeBlasts(events, 1171)).toHaveLength(0)
    expect(activeBlasts(events, 1140)[0].strength).toBe(1)
    expect(activeBlasts(events, 1140)[0].age).toBe(0)
    expect(activeBlasts(events, 1155)[0].strength).toBe(1)
    expect(activeBlasts(events, 1155)[0].age).toBe(15)
    expect(activeBlasts(events, 1166)[0].strength).toBe(0.5)
    expect(activeBlasts(events, 1170)[0].strength).toBe(0)
  })
})
