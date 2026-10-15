import { DAY_END, DAY_START, hm } from './model'

/**
 * A stretch of the day that plays, and is drawn on the strip, `factor` times shorter than it is on the clock. A squeeze with a `tag`
 * is one the clock plays through at that speed: the strip hatches it and writes the tag over it. `pace` (default 1) makes the clock run
 * that many times faster through the squeeze without changing how wide it is drawn: `factor` is the layout, `pace` the playback.
 */
export type Squeeze = { from: number; to: number; factor: number; tag?: string; pace?: number }

/**
 * Where the day is squeezed (minutes after midnight): the stretch before the first shot, which is the film about Felipe Ángeles (the clock
 * does not play through it: Play shows the film, then goes to 10:00; the squeeze only keeps it one hour wide on the strip), and the long
 * middle of the day, between La Sierpe falling and the attack on El Grillo, when the lines hold and the clock does run faster. Each is one
 * hour of the strip.
 */
export const SQUEEZES: readonly Squeeze[] = [
  { from: hm(0), to: hm(10), factor: 10 },
  { from: hm(12), to: hm(16), factor: 4, tag: '×7' },
]

/** The day cut at the squeezes, each piece with the bar minute it starts at. */
type Piece = { from: number; to: number; factor: number; bar: number; pace: number }

function pieces(squeezes: readonly Squeeze[]): Piece[] {
  const out: Piece[] = []
  let at = DAY_START
  let bar = 0
  const push = (from: number, to: number, factor: number, pace = 1) => {
    if (to <= from) return
    out.push({ from, to, factor, bar, pace })
    bar += (to - from) / factor
  }
  for (const s of [...squeezes].sort((a, b) => a.from - b.from)) {
    push(at, Math.min(s.from, DAY_END), 1)
    push(Math.max(s.from, at), Math.min(s.to, DAY_END), s.factor, s.pace)
    at = Math.max(at, Math.min(s.to, DAY_END))
  }
  push(at, DAY_END, 1)
  return out
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi)
const barEnd = (ps: readonly Piece[]) => {
  const last = ps[ps.length - 1]
  return last.bar + (last.to - last.from) / last.factor
}

/**
 * Minutes of the strip (the "bar") at clock minute `t`: one per clock minute, except inside a squeeze, where `factor` clock
 * minutes make one. The strip is drawn, and the clock plays, in bar minutes.
 */
export function toBar(t: number, squeezes: readonly Squeeze[] = SQUEEZES): number {
  const ps = pieces(squeezes)
  const c = clamp(t, DAY_START, DAY_END)
  const p = ps.find((x) => c <= x.to) ?? ps[ps.length - 1]
  return p.bar + (c - p.from) / p.factor
}

/** The clock minute at bar minute `b`: the other way round from `toBar`. */
export function fromBar(b: number, squeezes: readonly Squeeze[] = SQUEEZES): number {
  const ps = pieces(squeezes)
  const c = clamp(b, 0, barEnd(ps))
  const p = [...ps].reverse().find((x) => c >= x.bar) ?? ps[0]
  return clamp(p.from + (c - p.bar) * p.factor, DAY_START, DAY_END)
}

/**
 * Moves `bar` on by `budget` bar minutes of playback at normal pace: through a squeeze with a `pace` the same budget goes that many
 * times further along the bar. Pieces are crossed in one go, with what is left of the budget carried over. Never goes past the end.
 */
export function advanceBar(bar: number, budget: number, squeezes: readonly Squeeze[] = SQUEEZES): number {
  const ps = pieces(squeezes)
  const end = barEnd(ps)
  let at = clamp(bar, 0, end)
  let left = budget
  while (left > 0 && at < end) {
    let i = 0
    while (i + 1 < ps.length && at >= ps[i + 1].bar) i++
    const p = ps[i]
    const edge = i + 1 < ps.length ? ps[i + 1].bar : end
    const cost = (edge - at) / p.pace
    if (left >= cost) {
      at = edge
      left -= cost
    } else {
      at += left * p.pace
      left = 0
    }
  }
  return at
}

/** The length of the whole day on the bar. */
export const BAR_END = toBar(DAY_END)
