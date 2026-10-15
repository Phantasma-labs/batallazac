import { describe, expect, it } from 'vitest'
import { EVENTS } from '../timeline/events'
import { hm, type TimelineEvent } from '../timeline/model'
import { gunAims, muzzleKey } from './gunFire'
import { placePoints } from './places'

const at = (id: string) => ({ x: id.length, z: id.length * 2 })
const event = (id: string, time: number, attacks: TimelineEvent['attacks']): TimelineEvent => ({
  id,
  track: 'angeles',
  time,
  title: { es: id, en: id },
  text: { es: '', en: '' },
  source: 'inferred',
  attacks,
})

describe('gun fire', () => {
  const events = [
    event('open', 600, [
      { unit: 'angeles', target: 'labufa', endTime: 660 },
      { unit: 'angeles', target: 'loreto', endTime: 660 },
      { unit: 'fed-bufa', target: 'vetagrande', endTime: 660 },
    ]),
    event('move', 660, [
      { unit: 'angeles', target: 'sierpe', startTime: 690, endTime: 720 },
      { unit: 'angeles-rear', target: 'labufa', startTime: 650, endTime: 1140 },
    ]),
  ]
  const { movers, stayers } = gunAims(events, at, 660)

  it('gives the guns that roll all of the angeles unit attacks, and only those', () => {
    expect(movers.map((a) => [a.unit, a.target, a.from, a.to])).toEqual([
      ['angeles', 'labufa', 600, 660],
      ['angeles', 'loreto', 600, 660],
      ['angeles', 'sierpe', 690, 720],
    ])
    expect(movers[0]).toMatchObject({ x: at('labufa').x, z: at('labufa').z })
  })
  it('gives the guns that stay the first barrage and then their own unit, never what the others fire from Loreto', () => {
    expect(stayers.map((a) => [a.unit, a.target, a.from, a.to])).toEqual([
      ['angeles', 'labufa', 600, 660],
      ['angeles', 'loreto', 600, 660],
      ['angeles-rear', 'labufa', 650, 1140],
    ])
  })
  it('keeps the barrels apart by unit as well as by target', () => {
    expect(muzzleKey('angeles', 'labufa')).not.toBe(muzzleKey('angeles-rear', 'labufa'))
    expect(muzzleKey('angeles', 'labufa')).toBe(muzzleKey('angeles', 'labufa'))
  })
  it('in the real day, keeps the two guns at Vetagrande firing on La Bufa until 19:00 and none of the five on La Sierpe after noon', () => {
    const places = placePoints()
    const real = gunAims(EVENTS, (id) => places.get(id)!, hm(10, 30)) // the guns set off when the battery divides
    expect(real.stayers.some((a) => a.unit === 'angeles-rear' && a.target === 'labufa' && a.to === hm(19))).toBe(true)
    expect(real.stayers.some((a) => a.target === 'sierpe')).toBe(false)
    for (const a of [...real.movers, ...real.stayers]) if (a.target === 'sierpe') expect(a.to).toBeLessThanOrEqual(hm(12))
  })
})
