import { describe, expect, it } from 'vitest'
import { createClock } from '../timeline/clock'
import { DAY_END, hm } from '../timeline/model'
import { lineIn } from '../timeline/narrationLines'
import { NARRATION, createNarrator, linesCrossed, type Voice } from './narration'

function fakeVoice() {
  const log: string[] = []
  const voice: Voice = {
    play: (s) => log.push(`play ${s}`),
    pause: () => log.push('pause'),
    resume: () => log.push('resume'),
    stop: () => log.push('stop'),
  }
  return { voice, log }
}

/** Runs the clock one tick of `seconds` the way the Director does. */
const frame = (c: ReturnType<typeof createClock>, n: ReturnType<typeof createNarrator>, seconds = 1 / 60) => {
  const before = c.time
  c.tick(seconds)
  n.afterTick(before, c.time)
}

describe('map narration', () => {
  it('has seven lines, at 10:00, 11:00, 12:00, 16:00, 17:00, 18:00 and 19:00, in order, the last one before the day ends', () => {
    expect(NARRATION.map((l) => l.at)).toEqual([hm(10), hm(11), hm(12), hm(16), hm(17), hm(18), hm(19)])
    expect(new Set(NARRATION.map((l) => l.src)).size).toBe(7)
    expect(NARRATION.at(-1)!.at).toBeLessThan(DAY_END)
  })

  it('finds the lines a step goes across, and none for a jump', () => {
    expect(linesCrossed(hm(10, 59.9), hm(11, 0.1)).map((l) => l.id)).toEqual(['n2'])
    expect(linesCrossed(hm(10), hm(10, 0.1)).map((l) => l.id)).toEqual(['n1'])
    expect(linesCrossed(hm(10, 0.1), hm(10, 0.2))).toEqual([])
    expect(linesCrossed(hm(9), hm(12))).toEqual([])
    expect(linesCrossed(hm(10, 30.1), hm(10, 29.9))).toEqual([])
  })

  it('speaks each line once as the playing clock goes across it', () => {
    const c = createClock(hm(9, 59))
    const { voice, log } = fakeVoice()
    const n = createNarrator(c, voice)
    c.play()
    let speakingFor = 0
    for (let i = 0; i < 60 * 100; i++) {
      frame(c, n) // 100 s of play: from 9:59 on to the end of the day, through the faster 12:00 to 16:00
      if (n.speaking) {
        speakingFor += 1 / 60
        const line = NARRATION.find((l) => log.at(-1) === `play ${l.src}`)
        if (line && speakingFor >= line.seconds) {
          speakingFor = 0
          n.ended() // the file reached its end
        }
      }
    }
    expect(log.filter((x) => x.startsWith('play'))).toEqual(NARRATION.map((l) => `play ${l.src}`))
    expect(log.filter((x) => x === 'stop')).toEqual([]) // nothing was cut off
  })

  it('ends every line before the next one is due, at the speed the clock plays that stretch', () => {
    NARRATION.forEach((line, k) => {
      const c = createClock(line.at)
      c.play()
      const next = NARRATION[k + 1]?.at ?? DAY_END
      let seconds = 0
      while (c.time < next && c.playing) {
        c.tick(1 / 60)
        seconds += 1 / 60
      }
      // room for the file and half a second for it to start
      expect(line.seconds + 0.5, line.id).toBeLessThan(seconds)
    })
  })

  it('lets a line that is still speaking finish and starts the next one the moment it ends', () => {
    const c = createClock(hm(10, 59))
    const { voice, log } = fakeVoice()
    const n = createNarrator(c, voice)
    c.play()
    // The 11:00 line starts, and its file is slow to end: the clock goes on across 12:00.
    for (let i = 0; i < 60 * 16; i++) frame(c, n)
    expect(c.time).toBeGreaterThan(hm(12))
    expect(log).toEqual([`play ${NARRATION[1].src}`]) // the 12:00 line waits: nothing started, nothing stopped
    n.ended()
    expect(log).toEqual([`play ${NARRATION[1].src}`, `play ${NARRATION[2].src}`])
    n.ended()
    expect(log).toHaveLength(2) // nothing more was waiting
  })

  it('does not speak when the clock is scrubbed onto or past a line while paused', () => {
    const c = createClock(hm(9, 59))
    const { voice, log } = fakeVoice()
    const n = createNarrator(c, voice)
    frame(c, n)
    c.seek(hm(10, 1))
    frame(c, n)
    c.seek(hm(11))
    frame(c, n)
    expect(log).toEqual([])
  })

  it('cuts the line off when the clock jumps, pauses it with the clock and goes on with it', () => {
    const c = createClock(hm(9, 59))
    const { voice, log } = fakeVoice()
    const n = createNarrator(c, voice)
    c.play()
    for (let i = 0; i < 20; i++) frame(c, n)
    expect(log).toEqual([`play ${NARRATION[0].src}`])
    c.pause()
    frame(c, n)
    c.play()
    frame(c, n)
    expect(log.slice(1)).toEqual(['pause', 'resume'])
    c.seek(hm(10, 10)) // a scrub while playing
    frame(c, n)
    expect(log.at(-1)).toBe('stop')
  })

  it('stays silent when muted, and muting stops the line that is speaking', () => {
    const c = createClock(hm(9, 59))
    const { voice, log } = fakeVoice()
    const n = createNarrator(c, voice)
    c.play()
    for (let i = 0; i < 20; i++) frame(c, n)
    n.setMuted(true)
    expect(log.at(-1)).toBe('stop')
    c.seek(hm(10, 29))
    for (let i = 0; i < 60 * 3; i++) frame(c, n)
    expect(log.filter((x) => x.startsWith('play'))).toHaveLength(1)
  })
})

describe('narration by language', () => {
  const line = { id: 'x', at: 600, src: 'es/1.mp3', seconds: 7 }
  it('speaks the English file, with its own length, on the English page, and the Spanish one on the Spanish page', () => {
    const source = { ...line, en: { src: 'en/1.mp3', seconds: 8.5 } }
    expect(lineIn(source, 'en')).toEqual({ id: 'x', at: 600, src: 'en/1.mp3', seconds: 8.5 })
    expect(lineIn(source, 'es')).toEqual(line)
  })
  it('keeps the Spanish voice until an English file exists', () => {
    expect(lineIn(line, 'en')).toEqual(line)
  })
})
