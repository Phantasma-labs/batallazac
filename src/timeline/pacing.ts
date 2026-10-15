import { DAY_END } from './model'
import type { NarrationLine } from './narrationLines'
import { NARRATION } from './narrationLines'
import { SQUEEZES, type Squeeze } from './timeScale'

/** Minutes of the strip (the "bar") that pass per real second before the narration starts: the speed of the hours before 10:00. */
export const BASE_RATE = 4
/** The breath after a line has been spoken, seconds, before the stretch ends and the next line is due (the author, 2026-10-13: 2 s). */
export const PAUSE_SECONDS = 2

/** A stretch of the day that takes exactly as long as its line and the pause after it: from the line's minute to the next line's (or the end of the day). */
export type Stretch = { from: number; to: number; seconds: number; /** Clock minutes per real second at speed 1. */ rate: number }

/**
 * The day's stretches, one per narration line: the map is paced by the voice, so a line is always heard in full and the next hotspot
 * arrives as it (and its pause) ends, never into silence.
 */
export function stretchesOf(lines: readonly NarrationLine[] = NARRATION, pause = PAUSE_SECONDS, end = DAY_END): Stretch[] {
  return lines.map((l, i) => {
    const to = lines[i + 1]?.at ?? end
    const seconds = l.seconds + pause
    return { from: l.at, to, seconds, rate: (to - l.at) / seconds }
  })
}

export const STRETCHES: readonly Stretch[] = stretchesOf()

const squeezeFactor = (t: number, squeezes: readonly Squeeze[]) => squeezes.find((s) => t >= s.from && t < s.to)?.factor ?? 1

/** Clock minutes per real second at clock minute `t` (speed 1): the stretch's own rate, else the base rate, faster through a squeezed stretch of the strip. */
export function rateAt(t: number, stretches: readonly Stretch[] = STRETCHES, squeezes: readonly Squeeze[] = SQUEEZES): number {
  const s = stretches.find((x) => t >= x.from && t < x.to)
  return s ? s.rate : BASE_RATE * squeezeFactor(t, squeezes)
}

/** The next clock minute after `t` where the rate can change. */
function edgeAfter(t: number, stretches: readonly Stretch[], squeezes: readonly Squeeze[], end: number): number {
  let edge = end
  for (const e of [...stretches.flatMap((s) => [s.from, s.to]), ...squeezes.flatMap((s) => [s.from, s.to])]) if (e > t + 1e-9 && e < edge) edge = e
  return edge
}

/**
 * The clock minute `seconds` of playing after `t`: each stretch goes at its own rate and a step that crosses an edge carries what is left
 * of it over at the next rate. Never goes past the end of the day.
 */
export function advanceClock(t: number, seconds: number, stretches: readonly Stretch[] = STRETCHES, squeezes: readonly Squeeze[] = SQUEEZES, end = DAY_END): number {
  let at = t
  let left = seconds
  while (left > 1e-12 && at < end) {
    const rate = rateAt(at, stretches, squeezes)
    const edge = edgeAfter(at, stretches, squeezes, end)
    const need = (edge - at) / rate
    if (left >= need) {
      at = edge
      left -= need
    } else {
      at += left * rate
      left = 0
    }
  }
  return Math.min(at, end)
}
