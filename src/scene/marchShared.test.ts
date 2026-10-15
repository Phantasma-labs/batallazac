import { describe, expect, it } from 'vitest'
import { EVENTS, UNITS } from '../timeline/events'
import { COLORS, colorOfUnit, marchesOf, resolveMarches, stopPoint } from './marchShared'
import { onGround, placePoints } from './places'
import type { Board } from './useBoard'

const places = onGround(placePoints(1.679, { elgrillo: 68.3 }), () => 0)
const board = { places, groundY: () => 0 } as unknown as Board

describe('resolveMarches', () => {
  const marches = resolveMarches(board)
  it('has every march of every event, set off at its own start (the event time unless it names one)', () => {
    const wanted = EVENTS.flatMap((e) => (e.marches ?? []).map((m) => [m.unit, m.startTime ?? e.time, m.endTime]))
    expect(marches.map((m) => [m.unit, m.start, m.end])).toEqual(wanted)
    expect(marches.length).toBeGreaterThan(10)
  })
  it('lays each path from its first stop to its last, in steps of a few units', () => {
    for (const e of EVENTS) {
      for (const m of e.marches ?? []) {
        const path = marches.find((r) => r.unit === m.unit && r.end === m.endTime)!.path
        const first = stopPoint(m.path[0], places), last = stopPoint(m.path[m.path.length - 1], places)
        const end = path[path.length - 1]
        expect([path[0].x, path[0].z], e.id).toEqual([first.x, first.z])
        expect(end.x, e.id).toBeCloseTo(last.x)
        expect(end.z, e.id).toBeCloseTo(last.z)
        for (let i = 1; i < path.length; i++) expect(Math.hypot(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z), e.id).toBeLessThanOrEqual(6.001)
      }
    }
  })
  it('hands each unit on from where its last march ended', () => {
    for (const u of UNITS) {
      const own = marches.filter((m) => m.unit === u.id).sort((a, b) => a.start - b.start)
      for (let i = 1; i < own.length; i++) {
        const from = own[i - 1].path[own[i - 1].path.length - 1], to = own[i].path[0]
        expect(Math.hypot(from.x - to.x, from.z - to.z), `${u.id} march ${i}`).toBeLessThan(1e-6)
      }
    }
  })
  it('is resolved once per board', () => {
    expect(marchesOf(board)).toBe(marchesOf(board))
  })
})

describe('colours', () => {
  it('has a colour for every unit: red for the revolutionaries (Ángeles included, 2026-10-13), blue for the federals', () => {
    for (const u of UNITS) expect(colorOfUnit(u.id), u.id).toBe(COLORS[u.track])
    expect(COLORS.angeles).toBe(COLORS.villa)
    expect(COLORS.federal).not.toBe(COLORS.villa)
    expect(Object.keys(COLORS).sort()).toEqual(['angeles', 'federal', 'villa'])
  })
})
