import { hm } from './model'

/**
 * How many of its bars a force has left. An infantry force is drawn as 16 bars (see `layoutOf`); each time the federals are beaten
 * the group that held the place loses some while it falls back (the author, 2026-10-13: "each time federals get defeated they lose
 * soldiers, and that should show in the blocks"). A loss runs from `from` to `to` (bars shrink away one after another, the last ones
 * of the formation first) and leaves `bars` standing. Units not named here keep all of their bars.
 *
 * By the time the groups from Loreto, La Sierpe and El Grillo reach La Bufa (17:45) they are 16 bars between the three, and with the
 * 16 of the garrison that was never beaten the federal army is half of what it was.
 */
export const FULL_BARS = 16
export type Loss = { from: number; to: number; bars: number }

export const LOSSES: Readonly<Record<string, readonly Loss[]>> = {
  // Cerro de Loreto falls to the guns at 11:00; the group falls back on the centre, which is stormed at 17:00.
  'fed-center': [
    { from: hm(11), to: hm(11, 30), bars: 12 },
    { from: hm(17), to: hm(17, 30), bars: 6 },
  ],
  // La Sierpe falls at 12:00 and its group is thrown back on El Grillo, which falls at 16:00; then the centre.
  'fed-sierpe': [
    { from: hm(12), to: hm(12, 30), bars: 11 },
    { from: hm(16, 20), to: hm(16, 55), bars: 8 },
    { from: hm(17), to: hm(17, 30), bars: 5 },
  ],
  // El Grillo falls at 16:00 (the assault 16:00 to 16:40); then the centre.
  'fed-grillo': [
    { from: hm(16), to: hm(16, 40), bars: 10 },
    { from: hm(17), to: hm(17, 30), bars: 5 },
  ],
}

/** The bars a unit has at minute `t` (fractional while a loss is under way). */
export function barsAt(unit: string, t: number, losses: Readonly<Record<string, readonly Loss[]>> = LOSSES): number {
  let bars = FULL_BARS
  for (const l of losses[unit] ?? []) {
    if (t <= l.from) break
    if (t >= l.to) {
      bars = l.bars
      continue
    }
    const k = (t - l.from) / (l.to - l.from)
    return bars + (l.bars - bars) * k
  }
  return bars
}

/** How much of bar number `rank` (0 = the last to go) is there when `bars` are left: 1 whole, 0 gone, a fraction while it shrinks away. */
export const presenceOf = (rank: number, bars: number) => Math.min(1, Math.max(0, bars - rank))

/**
 * The order a formation loses its bars in, as a rank per piece (0 = the last to go): the front line keeps its middle longest, the back
 * line and the wings go first.
 */
export function lossRanks(pieces: readonly { front: { x: number; z: number } }[]): number[] {
  const order = pieces.map((_, i) => i).sort((a, b) => pieces[b].front.x - pieces[a].front.x || Math.abs(pieces[a].front.z) - Math.abs(pieces[b].front.z))
  const ranks = new Array<number>(pieces.length)
  order.forEach((i, k) => (ranks[i] = k))
  return ranks
}
