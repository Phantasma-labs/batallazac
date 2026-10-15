import { clock as appClock, type Clock } from '../timeline/clock'

export { NARRATION, type NarrationLine } from '../timeline/narrationLines'
import { NARRATION, type NarrationLine } from '../timeline/narrationLines'

/** The most clock minutes one frame may move the clock and still count as playing through (more is a jump, a scrub). */
export const MAX_STEP = 6

/** The lines the clock went across in one step from `before` to `after` (a line at `before` counts: a start at exactly 10:00 plays it). */
export function linesCrossed(before: number, after: number, lines: readonly NarrationLine[] = NARRATION): NarrationLine[] {
  if (!(after > before) || after - before > MAX_STEP) return []
  return lines.filter((l) => l.at >= before && l.at < after)
}

/** What the narrator needs of a sound: start a file, pause and resume it, stop it. */
export interface Voice {
  play(src: string): void
  pause(): void
  resume(): void
  stop(): void
}

/**
 * Plays the lines over a clock. `afterTick` is called every frame with the clock's time before and after its tick: a line starts when
 * a playing clock goes across it; the voice pauses with the clock and goes on with it; a jump of the clock (a scrub) cuts the line
 * off, and so does turning the narration off. A line never cuts another off: if one is still speaking when the next one's minute comes,
 * the next waits and starts the moment the first ends (only the latest waiting line is kept).
 */
export function createNarrator(clock: Clock, voice: Voice, lines: readonly NarrationLine[] = NARRATION) {
  let last = NaN
  let speaking = false
  let paused = false
  let muted = false
  let waiting: NarrationLine | null = null
  const listeners = new Set<() => void>()
  const start = (line: NarrationLine) => {
    speaking = true
    paused = false
    voice.play(line.src)
  }
  const stop = () => {
    if (speaking) voice.stop()
    speaking = false
    paused = false
    waiting = null
  }
  return {
    get muted() {
      return muted
    },
    setMuted(value: boolean) {
      muted = value
      if (muted) stop()
      listeners.forEach((l) => l())
    },
    subscribe(l: () => void) {
      listeners.add(l)
      return () => {
        listeners.delete(l)
      }
    },
    snapshot: () => muted,
    /** A line is being spoken now (the music ducks under it). */
    get speaking() {
      return speaking && !paused
    },
    afterTick(before: number, after: number) {
      // The clock was moved from outside since the last frame: a scrub or a jump.
      if (!Number.isNaN(last) && Math.abs(before - last) > 1e-6) stop()
      last = after
      if (speaking) {
        if (!clock.playing && !paused) {
          voice.pause()
          paused = true
        } else if (clock.playing && paused) {
          voice.resume()
          paused = false
        }
      }
      if (!clock.playing || muted) return
      const line = linesCrossed(before, after, lines).at(-1)
      if (!line) return
      if (speaking) waiting = line
      else start(line)
    },
    /** The line ended by itself: the one that waited for it starts now. */
    ended() {
      speaking = false
      paused = false
      const next = waiting
      waiting = null
      if (next && clock.playing && !muted) start(next)
    },
  }
}

/**
 * The page's voice. Every line's file is loaded ahead (`preload`), one element each, so a line starts the moment it is asked for; only
 * one element plays at a time (a new `play` stops whichever was playing). A failed or missing file is skipped without a word.
 */
function createAudioVoice(srcs: readonly string[], onEnded: () => void): Voice {
  const els = new Map<string, HTMLAudioElement>()
  let current: HTMLAudioElement | null = null
  const element = (src: string) => {
    let a = els.get(src)
    if (!a) {
      a = new Audio()
      a.preload = 'auto'
      a.onended = () => {
        if (a === current) onEnded()
      }
      a.onerror = () => {
        if (a === current) onEnded()
      }
      a.src = src
      els.set(src, a)
    }
    return a
  }
  if (typeof Audio !== 'undefined') for (const src of srcs) element(src)
  const rewind = (a: HTMLAudioElement) => {
    a.pause()
    try {
      a.currentTime = 0
    } catch {
      // not loaded yet: it starts from the beginning anyway
    }
  }
  return {
    play(src) {
      try {
        if (current) rewind(current)
        const a = element(src)
        current = a
        rewind(a)
        void a.play().catch(onEnded)
      } catch {
        onEnded()
      }
    },
    pause: () => current?.pause(),
    resume: () => void current?.play().catch(onEnded),
    stop() {
      if (current) rewind(current)
      current = null
    },
  }
}

const KEY = 'toma.narration.muted'
const readMuted = () => {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

const voice = createAudioVoice(NARRATION.map((l) => l.src), () => narration.ended())
/** The app's narrator. */
export const narration = createNarrator(appClock, voice)
if (typeof window !== 'undefined') narration.setMuted(readMuted())
narration.subscribe(() => {
  try {
    localStorage.setItem(KEY, narration.muted ? '1' : '0')
  } catch {
    // private window: the choice just is not remembered
  }
})

// A hot reload makes a new narrator: let the old one's line stop first, so nothing sounds twice.
if (import.meta.hot) import.meta.hot.dispose(() => voice.stop())
