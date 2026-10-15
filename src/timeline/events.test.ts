import { describe, expect, it } from 'vitest'
import { HOTSPOTS } from '../camera/hotspots'
import { EXITS, FEDERAL_POSTS, FEDERAL_STANDS, NATERA_POST, PINS, placePoints } from '../scene/places'
import { focusEvent } from '../ui/captions'
import { EVENTS, UNITS } from './events'
import { DAY_END, DAY_START, hm, type PathStop } from './model'

const places = placePoints()
const unitIds = new Set(UNITS.map((u) => u.id))
const eventOf = (id: string) => EVENTS.find((e) => e.id === id)!

/** Every march of one unit with the minute it sets off, in the order it walks them. */
const marchesOf = (unit: string) =>
  EVENTS.flatMap((e) => (e.marches ?? []).filter((m) => m.unit === unit).map((m) => ({ ...m, start: m.startTime ?? e.time, event: e.id })))
    .sort((a, b) => a.start - b.start)
/** Every attack of one unit with its window. */
const attacksOf = (unit: string) =>
  EVENTS.flatMap((e) => (e.attacks ?? []).filter((a) => a.unit === unit).map((a) => ({ ...a, start: a.startTime ?? e.time, event: e.id })))

describe('event data', () => {
  it('has unique ids and times inside the day', () => {
    expect(new Set(EVENTS.map((e) => e.id)).size).toBe(EVENTS.length)
    for (const e of EVENTS) {
      expect(e.time, e.id).toBeGreaterThanOrEqual(DAY_START)
      expect(e.time, e.id).toBeLessThanOrEqual(DAY_END)
    }
  })
  it('is written in time order', () => {
    const times = EVENTS.map((e) => e.time)
    expect(times).toEqual([...times].sort((a, b) => a - b))
  })
  it('gives every event both languages and a source', () => {
    for (const e of EVENTS) {
      expect(e.title.es && e.title.en && e.text.es && e.text.en, e.id).toBeTruthy()
      expect(['sourced', 'inferred']).toContain(e.source)
    }
  })
  it('only names places, units and shots that exist, and keeps every window inside the day', () => {
    const shots = new Set(['wide', ...HOTSPOTS.map((h) => h.id), 'march-villa-sierpe', 'march-vetagrande-loreto'])
    for (const u of UNITS) expect(places.has(u.start as string), u.id).toBe(true)
    for (const e of EVENTS) {
      if (e.shot) expect(shots.has(e.shot), `${e.id} shot ${e.shot}`).toBe(true)
      for (const m of e.marches ?? []) {
        expect(unitIds.has(m.unit), `${e.id} march of ${m.unit}`).toBe(true)
        expect(m.startTime ?? e.time, e.id).toBeGreaterThanOrEqual(DAY_START)
        expect(m.endTime, e.id).toBeGreaterThan(m.startTime ?? e.time)
        expect(m.endTime, e.id).toBeLessThanOrEqual(DAY_END)
        expect(m.path.length, e.id).toBeGreaterThanOrEqual(2)
        for (const s of m.path) if (typeof s === 'string') expect(places.has(s), `${e.id} stop ${s}`).toBe(true)
      }
      for (const a of e.attacks ?? []) {
        expect(unitIds.has(a.unit), e.id).toBe(true)
        expect(places.has(a.target), `${e.id} target ${a.target}`).toBe(true)
        expect(a.startTime ?? e.time, e.id).toBeGreaterThanOrEqual(DAY_START)
        expect(a.endTime, e.id).toBeGreaterThan(a.startTime ?? e.time)
        expect(a.endTime, e.id).toBeLessThanOrEqual(DAY_END)
      }
      for (const b of e.blasts ?? []) {
        expect(places.has(b.at), `${e.id} blast at ${b.at}`).toBe(true)
        expect(b.endTime, e.id).toBeGreaterThan(e.time)
        expect(b.endTime, e.id).toBeLessThanOrEqual(DAY_END)
      }
    }
  })
  it('chains each unit march: each starts where the last ended, and never before it ended', () => {
    for (const u of UNITS) {
      let at: PathStop = u.start
      let free = DAY_START
      for (const m of marchesOf(u.id)) {
        expect(m.path[0], `${m.event} starts where ${u.id} stood`).toBe(at)
        expect(m.start, `${m.event}: ${u.id} is still on its last march`).toBeGreaterThanOrEqual(free)
        at = m.path[m.path.length - 1]
        free = m.endTime
      }
    }
  })
  it('has the stops the user asked for: the film at 0 h, then 10, 11, 12, 16, 17, 18 and 19 h', () => {
    const times = new Set(EVENTS.map((e) => e.time))
    for (const h of [0, 10, 11, 12, 16, 17, 18, 19]) expect(times.has(hm(h)), `${h}:00`).toBe(true)
    // Nothing else: Ángeles, Villa and Natera all start at 10:00 (there is no 10:05).
    expect([...times].sort((a, b) => a - b)).toEqual([hm(0), hm(10), hm(11), hm(12), hm(16), hm(17), hm(18), hm(19), hm(20)])
  })
  it('gives each unit its side: the federal army only ever fires back, with no arrows of its own', () => {
    expect(UNITS.filter((u) => u.track === 'federal').map((u) => u.id).sort()).toEqual(['fed-bufa', 'fed-center', 'fed-grillo', 'fed-sierpe'])
    expect(UNITS.find((u) => u.id === 'natera')?.track).toBe('villa')
    expect(UNITS.find((u) => u.id === 'angeles')?.track).toBe('angeles')
    expect(UNITS.find((u) => u.id === 'angeles-rear')?.track).toBe('angeles')
  })
  it("names Villa's and Natera's columns by their divisions, in both languages", () => {
    expect(UNITS.find((u) => u.id === 'villa')?.label).toEqual({ es: 'División del Norte', en: 'División del Norte' })
    expect(UNITS.find((u) => u.id === 'natera')?.label).toEqual({ es: 'División del Centro', en: 'División del Centro' })
  })
  it('has no unit that is not on the board from the start (nobody enters late any more)', () => {
    for (const u of UNITS) expect(Object.keys(u).sort(), u.id).toEqual(['id', 'label', 'start', 'track'])
  })
})

describe('the day, as the author wrote it', () => {
  it('opens at 10 h: the whole battery fires on La Bufa and Cerro de Loreto until it divides at 10:30, Natera on El Grillo', () => {
    const guns = eventOf('angeles-opens-fire')
    expect(guns.time).toBe(hm(10))
    const aimed = (guns.attacks ?? []).filter((a) => a.unit === 'angeles')
    expect(aimed.map((a) => a.target).sort()).toEqual(['labufa', 'loreto'])
    for (const a of aimed) expect([a.startTime ?? guns.time, a.endTime]).toEqual([hm(10), hm(10, 30)])
    const natera = attacksOf('natera').find((a) => a.target === 'elgrillo')!
    expect(natera.start).toBe(hm(10))
    expect(UNITS.find((u) => u.id === 'natera')?.start).toBe('suroeste')
  })
  it('starts the three armies together at 10:00, and the caption plate then shows the cannon shot', () => {
    for (const id of ['natera-opens-fire', 'villa-advances', 'angeles-opens-fire']) expect(eventOf(id).time, id).toBe(hm(10))
    // The latest event written at a minute is the one the plate shows: the sourced 10:00 cannon shot.
    expect(focusEvent(EVENTS, hm(10))?.id).toBe('angeles-opens-fire')
    expect(marchesOf('villa')[0].start).toBe(hm(10))
  })
  it('has Villa fire on La Sierpe the whole way there and until it falls', () => {
    expect(eventOf('villa-advances').time).toBe(hm(10))
    const march = marchesOf('villa')[0]
    expect(march.path).toEqual(['villa-troops', 'sierpe'])
    // He arrives as he takes the hill, at noon.
    expect(march.endTime).toBe(hm(12))
    const fire = attacksOf('villa').find((a) => a.target === 'sierpe')!
    expect(fire.start).toBe(march.start)
    expect(fire.endTime).toBe(hm(12))
  })
  it('divides the battery at 10:30 and has half of it on Loreto at 11 h, firing from there on La Bufa, La Sierpe and El Grillo', () => {
    const e = eventOf('angeles-advances')
    expect(e.time).toBe(hm(11))
    const march = e.marches!.find((m) => m.unit === 'angeles')!
    expect(march.path).toEqual(['angeles-guns', 'loreto'])
    // This half sets off when the battery divides, and is on Loreto at the tick.
    expect([march.startTime, march.endTime]).toEqual([hm(10, 30), hm(11)])
    const aimed = (e.attacks ?? []).filter((a) => a.unit === 'angeles')
    expect(aimed.map((a) => a.target).sort()).toEqual(['elgrillo', 'labufa', 'sierpe'])
    for (const a of aimed) expect(a.startTime ?? e.time, a.target).toBeGreaterThanOrEqual(march.endTime)
    // The guns fire from the first position and from Loreto, and nowhere else: Loreto first, then the three hills.
    expect(attacksOf('angeles').map((a) => a.target).sort()).toEqual(['elgrillo', 'labufa', 'labufa', 'loreto', 'sierpe'])
    // The half on the march does not fire on its way.
    for (const a of attacksOf('angeles')) expect(a.endTime <= hm(10, 30) || a.start >= hm(11), a.target).toBe(true)
  })
  it('takes La Sierpe at noon, and the guns stop firing on it at that minute', () => {
    expect(eventOf('sierpe-taken').time).toBe(hm(12))
    expect(marchesOf('villa')[0].endTime).toBe(hm(12))
    const onSierpe = attacksOf('angeles').filter((a) => a.target === 'sierpe')
    expect(onSierpe).toHaveLength(1)
    expect(onSierpe[0].endTime).toBe(hm(12))
    // Nothing of Ángeles' fires on it afterwards.
    for (const unit of ['angeles', 'angeles-rear']) for (const a of attacksOf(unit)) expect(a.target === 'sierpe' && a.endTime > hm(12), unit).toBe(false)
  })
  it('holds La Sierpe with federals who fire back at Villa from 10:00, and throws them back on El Grillo at noon', () => {
    expect(UNITS.find((u) => u.id === 'fed-sierpe')).toMatchObject({ track: 'federal', start: 'sierpe-federales' })
    const fire = attacksOf('fed-sierpe').find((a) => a.target === 'villa-troops')!
    expect([fire.start, fire.endTime]).toEqual([hm(10), hm(12)])
    const back = marchesOf('fed-sierpe')[0]
    expect(back.path).toEqual(['sierpe-federales', 'grillo-sierpe'])
    expect(back.event).toBe('sierpe-taken')
    expect(back.start).toBe(hm(12))
    expect(back.endTime).toBeLessThanOrEqual(hm(13))
  })
  it('walks the Sierpe federals on from El Grillo to the centre, La Bufa and the south-east corner, each time with the others', () => {
    const walk = marchesOf('fed-sierpe')
    expect(walk.map((m) => m.path)).toEqual([
      ['sierpe-federales', 'grillo-sierpe'],
      ['grillo-sierpe', 'centro-sierpe'],
      ['centro-sierpe', 'bufa-fed-3'],
      ['bufa-fed-3', 'salida-4'],
    ])
    const grillo = marchesOf('fed-grillo')
    expect(walk[1].start).toBe(grillo[0].start)
    expect(walk[1].endTime).toBe(grillo[0].endTime)
    expect(walk[2].start).toBe(marchesOf('fed-center')[1].start)
    expect(walk[2].endTime).toBe(marchesOf('fed-grillo')[1].endTime)
    expect(walk[3].start).toBe(marchesOf('fed-bufa')[0].start)
    expect(walk[3].endTime).toBe(marchesOf('fed-bufa')[0].endTime)
    expect(Object.keys(EXITS)).toContain('salida-4')
  })
  it('keeps the half of the battery that stays at Vetagrande firing on La Bufa from the end of the first barrage until it falls', () => {
    const rear = attacksOf('angeles-rear')
    expect(rear.map((a) => a.target)).toEqual(['labufa', 'loreto'])
    expect(rear[0].endTime).toBe(hm(19))
    // They also cover the advance on Loreto, until the hill is taken at 11 h.
    expect([rear[1].start, rear[1].endTime]).toEqual([hm(10, 20), hm(11)])
    // They take over from the first barrage as it fades, so La Bufa is never left without fire from Vetagrande.
    const first = attacksOf('angeles').find((a) => a.target === 'labufa' && a.start === hm(10))!
    expect(rear[0].start).toBeLessThan(first.endTime)
    expect(rear[0].start).toBeGreaterThanOrEqual(first.endTime - 10)
    expect(marchesOf('angeles-rear')).toEqual([])
    expect(UNITS.find((u) => u.id === 'angeles-rear')?.start).toBe('angeles-rear')
  })
  it('sends Villa on to El Grillo the minute he has La Sierpe, and he fires on it from then until the assault', () => {
    const e = eventOf('sierpe-taken')
    const walk = marchesOf('villa')
    expect(walk.map((m) => m.path)).toEqual([
      ['villa-troops', 'sierpe'],
      ['sierpe', 'elgrillo-nw'],
      ['elgrillo-nw', 'centro-villa'],
      ['centro-villa', 'bufa-villa'],
    ])
    // He does not wait for the afternoon: he sets off from La Sierpe as he takes it, in the same event, and is on El Grillo by 12:30.
    expect(walk[1]).toMatchObject({ event: e.id, start: hm(12) })
    expect(walk[1].start).toBe(walk[0].endTime)
    expect(walk[1].endTime).toBeLessThanOrEqual(hm(12, 30))
    // He fires on El Grillo as he goes and keeps on until the assault is over.
    const fire = attacksOf('villa').find((a) => a.target === 'elgrillo')!
    expect([fire.start, fire.endTime]).toEqual([hm(12), hm(16, 40)])
    // The federals thrown back on El Grillo fire back at him from the minute he gets there.
    const back = attacksOf('fed-sierpe').find((a) => a.target === 'elgrillo-nw')!
    expect(back.start).toBe(walk[1].endTime)
    expect(back.endTime).toBe(hm(16, 20))
  })
  it('takes El Grillo at 16 h: Natera storms it, Villa is already on it, and the federals there fall back on the city centre', () => {
    const e = eventOf('grillo-taken')
    expect(e.time).toBe(hm(16))
    // Villa has been at El Grillo since 12:30: only Natera marches now.
    expect(e.marches!.some((m) => m.unit === 'villa')).toBe(false)
    const natera = e.marches!.find((m) => m.unit === 'natera')!
    expect(natera.path.at(-1)).toBe('elgrillo-sw')
    const fall = e.marches!.find((m) => m.unit === 'fed-grillo')!
    expect(fall.path).toEqual(['grillo-federales', 'centro-federales-2'])
    // They hold the hill until the attackers arrive, then walk off it.
    expect(natera.endTime).toBeLessThanOrEqual(fall.startTime!)
    // Natera has been firing at El Grillo since 10 h and keeps on while it closes in; Villa until it is taken.
    expect(attacksOf('natera').find((a) => a.target === 'elgrillo')!.endTime).toBeGreaterThanOrEqual(hm(16, 40))
    expect(attacksOf('villa').find((a) => a.target === 'elgrillo')!.endTime).toBeGreaterThanOrEqual(hm(16, 40))
  })
  it('takes the city centre at 17 h, with the explosion in it, and the federals then fall back on La Bufa', () => {
    const e = eventOf('centro-taken')
    expect(e.time).toBe(hm(17))
    expect(e.blasts).toEqual([{ at: 'centro', endTime: hm(17, 30) }])
    // Both armies arrive at 17 h, and fire on the centre as they come.
    for (const unit of ['villa', 'natera']) {
      const march = e.marches!.find((m) => m.unit === unit)!
      expect(march.endTime, unit).toBe(hm(17))
      expect(march.path.at(-1), unit).toMatch(/^centro-/)
      expect(attacksOf(unit).some((a) => a.target === 'centro' && a.endTime === hm(17)), unit).toBe(true)
    }
    // After the explosion the federals of the centre and of El Grillo go to La Bufa: nothing of theirs leaves before it.
    const federal = e.marches!.filter((m) => m.unit.startsWith('fed-'))
    expect(federal.map((m) => m.unit).sort()).toEqual(['fed-center', 'fed-grillo', 'fed-sierpe'])
    for (const m of federal) {
      expect(m.startTime ?? e.time, m.unit).toBeGreaterThanOrEqual(hm(17))
      expect(m.path.at(-1), m.unit).toMatch(/^bufa-fed-/)
    }
    expect(marchesOf('fed-center')[1].start).toBe(hm(17))
  })
  it('holds Cerro de Loreto with the centre federals until 11 h, when the guns take it, and they fall back on the city centre', () => {
    expect(UNITS.find((u) => u.id === 'fed-center')?.start).toBe('loreto-federales')
    const [fall] = marchesOf('fed-center')
    expect(fall.path).toEqual(['loreto-federales', 'centro-federales'])
    expect(fall.start).toBe(hm(11))
    // They stand beside the pin, not on the spot where the guns arrive.
    const loreto = places.get('loreto')!, post = places.get('loreto-federales')!
    expect(Math.hypot(post.x - loreto.x, post.z - loreto.z)).toBeGreaterThan(30)
    expect(Math.hypot(post.x - loreto.x, post.z - loreto.z)).toBeLessThan(90)
  })
  it('attacks La Bufa at 18 h with Villa, Natera and the guns, the federals answering', () => {
    const e = eventOf('bufa-assault')
    expect(e.time).toBe(hm(18))
    expect(EVENTS.some((x) => x.time === hm(18) && x.track === 'angeles')).toBe(true)
    expect(e.marches!.map((m) => m.path.at(-1)).sort()).toEqual(['bufa-villa', 'labufa-sur'])
    expect((e.attacks ?? []).filter((a) => a.unit === 'villa' || a.unit === 'natera').map((a) => a.target)).toEqual(['labufa', 'labufa'])
    expect(new Set((e.attacks ?? []).filter((a) => a.unit.startsWith('fed-')).map((a) => a.unit))).toEqual(new Set(['fed-bufa', 'fed-center', 'fed-grillo', 'fed-sierpe']))
    // The guns go on firing on La Bufa until it falls.
    expect(attacksOf('angeles').find((a) => a.target === 'labufa' && a.start >= hm(11))!.endTime).toBe(hm(19))
  })
  it('takes La Bufa at 19 h, and the federals leave past the south-east corner of the map', () => {
    const e = eventOf('bufa-taken')
    expect(e.time).toBe(hm(19))
    expect(e.marches!.map((m) => m.unit).sort()).toEqual(['fed-bufa', 'fed-center', 'fed-grillo', 'fed-sierpe'])
    for (const m of e.marches!) expect(m.path.at(-1), m.unit).toMatch(/^salida-/)
    expect(e.marches!.map((m) => m.path.at(-1)).sort()).toEqual(Object.keys(EXITS).sort())
    expect(Math.max(...e.marches!.map((m) => m.endTime))).toBeLessThanOrEqual(DAY_END)
  })
})

describe('video hotspots', () => {
  const withVideo = EVENTS.filter((e) => e.video)
  it('opens the day with a film about Felipe Ángeles at 00:00 that hands over to 10:00', () => {
    const e = eventOf('felipe-angeles')
    expect(e.time).toBe(hm(0))
    expect(e.track).toBe('angeles')
    expect(e.video).toEqual({ id: 'felipe-angeles', resumeAt: hm(10) })
    expect(EVENTS[0].id).toBe('felipe-angeles')
  })
  it('puts a video on 12:00, 16:00, 17:00 and 19:00, and none on 10:00, 11:00 or 18:00', () => {
    expect(withVideo.map((e) => [e.time, e.video!.id])).toEqual([
      [hm(0), 'felipe-angeles'],
      [hm(12), 'villistas'],
      [hm(16), 'natera'],
      [hm(17), 'zacatecas-centro'],
      [hm(19), 'la-bufa'],
      [hm(20), 'battle-over'],
    ])
    for (const h of [10, 11, 18]) for (const e of EVENTS.filter((x) => x.time === hm(h))) expect(e.video, e.id).toBeUndefined()
  })
  it('resumes every video inside the day, never before it began', () => {
    for (const e of withVideo) {
      const at = e.video!.resumeAt ?? e.time
      expect(at, e.id).toBeGreaterThanOrEqual(e.time)
      expect(at, e.id).toBeLessThanOrEqual(DAY_END)
    }
  })
})

describe('pins and places', () => {
  it('La Sierpe and Cerro de Loreto are pins without a hotspot, the rest click through to one', () => {
    const forShow = ['sierpe', 'loreto', 'toma']
    for (const id of forShow) expect(PINS.find((p) => p.id === id)?.hotspotId, id).toBeUndefined()
    for (const p of PINS.filter((x) => !forShow.includes(x.id))) expect(HOTSPOTS.some((h) => h.id === p.hotspotId), p.id).toBe(true)
  })
  it('puts Cerro de Loreto between Vetagrande and the city, north of the cathedral', () => {
    const v = places.get('vetagrande')!, l = places.get('loreto')!, c = places.get('centro')!
    expect(l.z).toBeLessThan(c.z)
    expect(l.z).toBeGreaterThan(v.z)
    expect(l.x).toBeGreaterThan(c.x)
    expect(l.x).toBeLessThan(v.x)
    expect(PINS.find((p) => p.id === 'loreto')?.hotspotId).toBeUndefined()
  })
  it('starts the guns that stay where the guns that go start, in the light version, where the battery is one formation that divides', () => {
    const together = placePoints(1, {}, true)
    expect(together.get('angeles-rear')).toEqual(together.get('angeles-guns'))
    // With the statues they start where their own two cannons stand.
    expect(places.get('angeles-rear')).not.toEqual(places.get('angeles-guns'))
  })
  it('puts La Sierpe north-west of El Grillo', () => {
    const g = places.get('elgrillo')!, s = places.get('sierpe')!
    expect(s.x).toBeLessThan(g.x)
    expect(s.z).toBeLessThan(g.z)
  })
  it("puts Villa's camp and soldiers in the north-west, between the compass and La Sierpe, and Natera's army in the south-west", () => {
    const camp = places.get('villa-camp')!, troops = places.get('villa-troops')!, s = places.get('sierpe')!, g = places.get('elgrillo')!, sw = places.get('suroeste')!
    expect(camp.z).toBeLessThan(s.z - 100) // well north of the hill
    expect(camp.x).toBeLessThan(g.x) // west of El Grillo
    expect(camp.z).toBeGreaterThan(-340) // south of the compass (z -339)
    expect(Math.hypot(troops.x - camp.x, troops.z - camp.z)).toBeGreaterThan(30) // beside the train, not on it
    expect(Math.hypot(troops.x - camp.x, troops.z - camp.z)).toBeLessThan(90)
    expect(sw).toMatchObject({ x: NATERA_POST.x, z: NATERA_POST.z })
    expect(sw.x).toBeLessThan(g.x)
    expect(sw.z).toBeGreaterThan(g.z)
  })
  it('starts the federal groups where their statues stand', () => {
    expect(places.get('grillo-federales')).toMatchObject({ x: FEDERAL_POSTS.grillo.x, z: FEDERAL_POSTS.grillo.z })
    expect(places.get('centro-federales')).toMatchObject({ x: FEDERAL_POSTS.centro.x, z: FEDERAL_POSTS.centro.z })
    expect(places.get('bufa-federales')).toMatchObject({ x: FEDERAL_POSTS.bufa.x, z: FEDERAL_POSTS.bufa.z })
  })
  it('stands the two armies beside each other at El Grillo, the centre and La Bufa, short of the federals and on their side of it', () => {
    const near = (a: string, b: string) => {
      const p = places.get(a)!, q = places.get(b)!
      return Math.hypot(p.x - q.x, p.z - q.z)
    }
    for (const [villa, natera, pin, federals] of [
      ['elgrillo-nw', 'elgrillo-sw', 'elgrillo', 'grillo-federales'],
      ['centro-villa', 'centro-natera', 'centro', 'centro-federales'],
      ['bufa-villa', 'labufa-sur', 'labufa', 'bufa-federales'],
    ]) {
      expect(near(villa, natera), `${villa} / ${natera}`).toBeGreaterThan(60) // statues are 20 to 30 units across
      for (const stand of [villa, natera]) {
        expect(near(stand, federals), `${stand} / ${federals}`).toBeGreaterThan(40)
        expect(near(stand, pin), `${stand} / ${pin}`).toBeLessThan(140)
        expect(places.get(stand)!.x, stand).toBeLessThan(places.get(pin)!.x) // they come from the west
      }
    }
  })
  it('stands the federals that fall back beside the garrison they join, not on it', () => {
    for (const [id, { from }] of Object.entries(FEDERAL_STANDS)) {
      const p = places.get(id)!
      expect(Math.hypot(p.x - FEDERAL_POSTS[from].x, p.z - FEDERAL_POSTS[from].z), id).toBeGreaterThan(30)
    }
    // The two groups that join La Bufa stand on opposite sides of its garrison.
    expect(places.get('bufa-fed-1')!.z).toBeLessThan(FEDERAL_POSTS.bufa.z)
    expect(places.get('bufa-fed-2')!.z).toBeGreaterThan(FEDERAL_POSTS.bufa.z)
  })
  it('puts the Sierpe federals on the hill, on the side toward El Grillo, apart from where Villa arrives', () => {
    const hill = places.get('sierpe')!, post = places.get('sierpe-federales')!, g = places.get('elgrillo')!
    const away = Math.hypot(post.x - hill.x, post.z - hill.z)
    expect(away).toBeGreaterThan(30)
    expect(away).toBeLessThan(90)
    expect(post.x).toBeGreaterThan(hill.x)
    expect(post.z).toBeGreaterThan(hill.z)
    expect(Math.hypot(post.x - g.x, post.z - g.z)).toBeLessThan(Math.hypot(hill.x - g.x, hill.z - g.z))
  })
  it('stands the Sierpe federals behind the garrison they join, on the east side, clear of where the attackers come from', () => {
    const post = FEDERAL_POSTS.grillo
    const stand = places.get('grillo-sierpe')!
    expect(stand.x).toBeGreaterThan(post.x)
    for (const attacker of ['elgrillo-nw', 'elgrillo-sw']) {
      const a = places.get(attacker)!
      expect(Math.hypot(stand.x - a.x, stand.z - a.z), attacker).toBeGreaterThan(60)
    }
    // At the centre they stand north of the garrison, as the Grillo group stands south; at La Bufa, east of it.
    expect(places.get('centro-sierpe')!.z).toBeLessThan(FEDERAL_POSTS.centro.z)
    expect(places.get('centro-federales-2')!.z).toBeGreaterThan(FEDERAL_POSTS.centro.z)
    expect(places.get('bufa-fed-3')!.x).toBeGreaterThan(FEDERAL_POSTS.bufa.x)
  })
  it('lets the federals out beyond the east of the opening view (it ends near x = 535), south-east of La Bufa', () => {
    const bufa = places.get('labufa')!
    for (const p of Object.values(EXITS)) {
      expect(p.x).toBeGreaterThan(560)
      expect(p.z).toBeGreaterThan(bufa.z)
    }
  })
  it('follows the stretch of the board', () => {
    const wide = placePoints(2)
    expect(wide.get('labufa')!.x).toBeCloseTo(places.get('labufa')!.x * 2)
  })
})
