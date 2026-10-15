import { labelCenter, type LabelSpec } from './labels'

/** A box on the ground plane, in world x and z. */
export type Rect = { x0: number; x1: number; z0: number; z1: number }

/** Area two boxes share. */
export function overlapArea(a: Rect, b: Rect): number {
  const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)
  const h = Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0)
  return w > 0 && h > 0 ? w * h : 0
}

/**
 * Where each place name lies on the ground, as a box with a margin round it (see `labels.ts`: the text hangs below its pin, shifted
 * and raised as its spec says, `cap` is the height of its capitals, the small line above doubles the block). Estimated from the letters, not measured: it
 * only has to tell a unit label which side of a force to go to.
 */
export function keepOutRects(labels: readonly LabelSpec[], places: ReadonlyMap<string, { x: number; z: number }>, margin = 8): Rect[] {
  const out: Rect[] = []
  for (const spec of labels) {
    const at = places.get(spec.id)
    if (!at) continue
    const block = spec.cap * (spec.kicker ? 1.9 : 1)
    const c = labelCenter(at, block, spec.shift, spec.rise)
    const halfW = (spec.name.length * spec.cap * (1 + spec.tracking * 1.47)) / 2 + margin
    const halfH = block / 2 + margin
    out.push({ x0: c.x - halfW, x1: c.x + halfW, z0: c.z - halfH, z1: c.z + halfH })
  }
  return out
}

const chip: Rect = { x0: 0, x1: 0, z0: 0, z1: 0 }

/**
 * The centre of a unit's label chip (`halfW` x `halfH` world units) round a force that covers `box`: under it, above it, or
 * beside it, whichever lies over the least place name (the first of these wins a tie, so the usual place is under the force).
 * Written into `out`.
 */
export function pickLabelSpot(box: Rect, halfW: number, halfH: number, keepOut: readonly Rect[], out: { x: number; z: number }, gap = 6): { x: number; z: number } {
  const cx = (box.x0 + box.x1) / 2
  const cz = (box.z0 + box.z1) / 2
  const below = box.z1 + halfH + gap
  const above = box.z0 - halfH - gap
  const right = box.x1 + halfW * 0.4
  const left = box.x0 - halfW * 0.4
  // The candidates, in order of preference: under, above, under to either side, above to either side, beside.
  let best = Infinity
  for (let i = 0; i < 8; i++) {
    const x = i === 0 || i === 1 ? cx : i === 2 || i === 4 ? right : i === 3 || i === 5 ? left : i === 6 ? box.x1 + halfW + gap : box.x0 - halfW - gap
    const z = i === 0 ? below : i === 1 ? above : i === 2 || i === 3 ? below : i === 4 || i === 5 ? above : cz
    let lost = 0
    chip.x0 = x - halfW
    chip.x1 = x + halfW
    chip.z0 = z - halfH
    chip.z1 = z + halfH
    for (const k of keepOut) lost += overlapArea(chip, k)
    if (lost < best) {
      best = lost
      out.x = x
      out.z = z
    }
    if (best === 0) break
  }
  return out
}
