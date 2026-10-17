import { describe, expect, it } from 'vitest'
import { EVENTS } from '../timeline/events'
import { hm, type TimelineEvent } from '../timeline/model'
import { captionText, firstSentence, focusEvent, laneOf, tickGroups, tickTip } from './captions'

const ev = (id: string, track: 'angeles' | 'villa' | 'federal', time: number, extra: Partial<TimelineEvent> = {}): TimelineEvent => ({
  id,
  track,
  time,
  title: { es: id, en: id },
  text: { es: '', en: '' },
  source: 'sourced',
  ...extra,
})

describe('focusEvent', () => {
  const events = [ev('a', 'angeles', 600), ev('v', 'villa', 605), ev('v2', 'villa', 660), ev('a2', 'angeles', 660)]

  it('is null before the first event', () => {
    expect(focusEvent(events, 599)).toBeNull()
  })
  it('is the latest event of either lane', () => {
    expect(focusEvent(events, 600)?.id).toBe('a')
    expect(focusEvent(events, 610)?.id).toBe('v')
  })
  it('takes the one written last on a tie, whichever lane it is in', () => {
    expect(focusEvent(events, 660)?.id).toBe('a2')
    expect(focusEvent([...events].reverse(), 660)?.id).toBe('v2')
  })
})

describe('the caption over the day', () => {
  it('opens the day with the film about Felipe Angeles at 00:00', () => {
    expect(focusEvent(EVENTS, hm(0))?.id).toBe('felipe-angeles')
    expect(focusEvent(EVENTS, hm(9, 30))?.id).toBe('felipe-angeles')
  })
  it('shows the one written last when several events share a minute', () => {
    expect(focusEvent(EVENTS, hm(10))?.id).toBe('angeles-opens-fire')
    expect(focusEvent(EVENTS, hm(18))?.id).toBe('bufa-assault')
  })
  it('follows the latest event at every time of the day', () => {
    expect(focusEvent(EVENTS, hm(10, 35))?.id).toBe('angeles-opens-fire')
    expect(focusEvent(EVENTS, hm(17, 10))?.id).toBe('centro-taken')
    expect(focusEvent(EVENTS, hm(19, 30))?.id).toBe('bufa-taken')
  })
})

describe('firstSentence', () => {
  it('cuts after the first full stop', () => {
    expect(firstSentence('Near noon the rebels take La Sierpe. With it lost, El Grillo falls.')).toBe('Near noon the rebels take La Sierpe.')
  })
  it('keeps a single sentence whole, with or without its full stop', () => {
    expect(firstSentence('Just one sentence.')).toBe('Just one sentence.')
    expect(firstSentence('No full stop here')).toBe('No full stop here')
  })
  it('does not cut inside a time, a number or an abbreviation followed by lower case', () => {
    expect(firstSentence('At 10:00 sharp a shot opens the battle. Batteries fire.')).toBe('At 10:00 sharp a shot opens the battle.')
    expect(firstSentence('The hill, 1.5 km north of the town, falls. Then the rest.')).toBe('The hill, 1.5 km north of the town, falls.')
  })
  it('handles accents, questions and empty text', () => {
    expect(firstSentence('¿Quién abre fuego? Ángeles abre fuego.')).toBe('¿Quién abre fuego?')
    expect(firstSentence('')).toBe('')
  })
  it('is never longer than the text, and never empty for real events', () => {
    for (const e of EVENTS) {
      const s = firstSentence(e.text.en)
      expect(s.length).toBeGreaterThan(0)
      expect(e.text.en.startsWith(s)).toBe(true)
    }
  })
})

describe('captionText', () => {
  it('is the first sentence when it is short enough', () => {
    expect(captionText('Short one. And more.', 96)).toBe('Short one.')
  })
  it('cuts a long sentence at a clause with an ellipsis, never inside a word', () => {
    const long = 'Ángeles moves his guns up from Vetagrande to Cerro de Loreto, halfway to the city, to pound the federal positions.'
    const out = captionText(long, 96)
    expect(out).toBe('Ángeles moves his guns up from Vetagrande to Cerro de Loreto, halfway to the city…')
    expect(out.length).toBeLessThanOrEqual(97)
  })
  it('falls back to the last word when there is no clause near the end', () => {
    const out = captionText('one two three four five six seven eight nine ten eleven twelve thirteen fourteen', 40)
    expect(out).toBe('one two three four five six seven eight…')
  })
  it('keeps every real event within the limit, and a prefix of its text', () => {
    for (const e of EVENTS) {
      const out = captionText(e.text.en)
      expect(out.length).toBeLessThanOrEqual(93)
      expect(e.text.en.startsWith(out.replace(/…$/, ''))).toBe(true)
    }
  })
})

describe('tickGroups', () => {
  it('joins events that share a minute, whoever they belong to', () => {
    const groups = tickGroups([ev('a', 'angeles', 660), ev('v1', 'villa', 660), ev('v2', 'villa', 660), ev('v3', 'villa', 700)])
    expect(groups.map((g) => [g.time, g.events.map((e) => e.id)])).toEqual([
      [660, ['a', 'v1', 'v2']],
      [700, ['v3']],
    ])
  })
  it('is hollow (inferred) only when nothing in the tick is sourced', () => {
    const inf = (id: string, time: number) => ev(id, 'villa', time, { source: 'inferred' })
    const [both] = tickGroups([inf('a', 780), inf('b', 780)])
    const [mixed] = tickGroups([inf('a', 780), ev('b', 'villa', 780)])
    expect(both.inferred).toBe(true)
    expect(mixed.inferred).toBe(false)
  })
  it('gives every real event exactly one tick', () => {
    const groups = tickGroups(EVENTS)
    expect(groups.reduce((n, g) => n + g.events.length, 0)).toBe(EVENTS.length)
    expect(groups.length).toBeLessThan(EVENTS.length)
    expect(new Set(groups.map((g) => g.time)).size).toBe(groups.length)
  })
})

describe('tickTip', () => {
  it('lists the time and one line per event, marking the inferred ones', () => {
    const [g] = tickGroups([ev('a', 'villa', 780), ev('b', 'villa', 780, { source: 'inferred' })])
    expect(tickTip(g, '13:00')).toBe('13:00\na\nb')
  })
})

describe('laneOf', () => {
  it('names the three sides', () => {
    expect(laneOf('angeles').name).toBe('Ángeles')
    expect(laneOf('villa').full).toBe('Pancho Villa')
    expect(laneOf('federal').name).toBe('Federales')
  })
})

describe('tickGroups and videos', () => {
  const film = (id: string, time: number, videoId?: string) => ev(id, 'villa', time, videoId ? { video: { id: videoId } } : {})
  const ready = (id: string) => id === 'here'
  it('marks a tick with a video that exists as ready, one whose file is missing as coming, and the rest as none', () => {
    const groups = tickGroups([film('a', 100, 'here'), film('b', 200, 'later'), film('c', 300)], ready)
    expect(groups.map((g) => g.video)).toEqual(['ready', 'coming', 'none'])
  })
  it('has no video anywhere when nothing is said to be ready or planned', () => {
    expect(tickGroups([film('a', 100), film('b', 200)]).map((g) => g.video)).toEqual(['none', 'none'])
    expect(tickGroups([film('a', 100, 'x')]).map((g) => g.video)).toEqual(['coming'])
  })
  it('lets a ready video win over a planned one in the same minute, and a planned one over none', () => {
    expect(tickGroups([film('a', 100, 'later'), film('b', 100, 'here')], ready)[0].video).toBe('ready')
    expect(tickGroups([film('a', 100), film('b', 100, 'later')], ready)[0].video).toBe('coming')
    expect(tickGroups([film('a', 100, 'here'), film('b', 100)], ready)[0].video).toBe('ready')
  })
  it('says so in the tip', () => {
    const [r] = tickGroups([film('a', 100, 'here')], ready)
    const [c] = tickGroups([film('a', 100, 'later')], ready)
    expect(tickTip(r, '01:40')).toBe('01:40\na\n▶ Video')
    expect(tickTip(c, '01:40')).toBe('01:40\na\nVideo próximamente')
  })
  it('in the real day, makes the film at 00:00 ready and the info ticks plain', () => {
    const groups = tickGroups(EVENTS, (id) => id === 'felipe-angeles')
    expect(groups.map((g) => [g.time, g.video])).toEqual([
      [0, 'ready'],
      [600, 'none'],
      [660, 'none'],
      [720, 'coming'],
      [960, 'coming'],
      [1020, 'coming'],
      [1080, 'none'],
      [1140, 'coming'],
      [1200, 'none'],
    ])
  })
})
