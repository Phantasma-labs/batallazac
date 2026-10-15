/**
 * Place names laid flat on the board, in the manner of an animated battle map: big, widely spaced capitals whose size
 * follows the importance of the place, with the small "Cerro de la" above the name. Pure data and maths (what is
 * written, how big, where, when it fades); `labelTexture.ts` draws it and `GroundLabel.tsx` puts it on the terrain.
 */
import { t } from '../i18n'

export type LabelSpec = {
  /** The pin it belongs to (see `PINS`). */
  id: string
  /** The small line above the name ("Cerro de la"). */
  kicker?: string
  name: string
  /** Height of the name's capitals, in world units: hills largest, the town smaller. The small line is half of it. */
  cap: number
  /** Extra space after each letter, in ems. */
  tracking: number
  /** False for a place on the flat (the city), whose surrounding rim says nothing about which way the lettering should lean. */
  lean?: boolean
  /** Sideways shift of the text from straight below its place, in world units (negative to the west): for a name that would lie over the hill itself. */
  shift?: number
  /** Extra shift of the text to the north from where it hangs below its place, in world units. */
  rise?: number
  /** The cap height the close-up fade is worked out from, when the lettering is much bigger than a place name (the title) and must fade like one. */
  fadeCap?: number
}

/** How far south of the pin's spot the top of the text starts, in world units. */
export const PIN_GAP = 12

/**
 * One rule for every place: the name hangs directly below the feature's spot, centred (see `labelCenter`). The sizes are
 * tiers that never change from shot to shot: the hills larger, the town smaller. They were chosen for the wide shot at
 * 1344 x 768, where one world unit is about one pixel; the names are small enough not to cover the hills they name.
 */
export const LABELS: LabelSpec[] = [
  { id: 'vetagrande', name: 'Vetagrande', cap: 10, tracking: 0.3, rise: 70 },
  { id: 'elgrillo', kicker: 'Cerro del', name: 'Grillo', cap: 11, tracking: 0.34, rise: -50 },
  // On the dome of the hill, north-east of the pin (the author's circle on a screenshot, 2026-10-12): hung straight below the pin the
  // name lay over the ridge where the battle is fought.
  { id: 'sierpe', kicker: 'Cerro de la', name: 'Sierpe', cap: 9.5, tracking: 0.34, shift: 108, rise: 142 },
  { id: 'loreto', kicker: 'Cerro de', name: 'Loreto', cap: 10.5, tracking: 0.34, shift: -50, rise: 2 },
  { id: 'labufa', kicker: 'Cerro de la', name: 'Bufa', cap: 11, tracking: 0.38 },
  { id: 'centro', kicker: 'Centro de', name: 'Zacatecas', cap: 8, tracking: 0.26, lean: false },
  // The map's title, beside the compass: not a place, so it is placed by `TOMA_TITLE` (places.ts) and sits on the flat.
  { id: 'toma', kicker: t('La Toma de', 'The Taking of'), name: 'Zacatecas', cap: 26, tracking: 0.34, lean: false, fadeCap: 13 },
]

/** The small line's letters against the name's: the name is twice as tall, in every label. */
export const KICKER_RATIO = 0.5

/** Extra space after a word, in ems: widely tracked words need more than a normal space to stay apart. */
export const WORD_GAP = 0.5

export type PlacedGlyph = { ch: string; x: number }

/**
 * The letters of one line with the x of each one's left edge, and the line's width. `measure` gives the width of a
 * string at the size being drawn; every letter but the last is followed by `tracking` ems, and a space by `WORD_GAP` more.
 */
export function layoutLine(text: string, size: number, tracking: number, measure: (s: string) => number): { glyphs: PlacedGlyph[]; width: number } {
  const glyphs: PlacedGlyph[] = []
  let x = 0
  const chars = [...text]
  chars.forEach((ch, i) => {
    glyphs.push({ ch, x })
    x += measure(ch) + (i < chars.length - 1 ? tracking * size : 0) + (ch === ' ' ? WORD_GAP * size : 0)
  })
  return { glyphs, width: x }
}

/** Where, in world coordinates, the middle of a label whose text is `blockHeight` tall lies for a pin at `at`: straight below it, or `shift` to the side. */
export function labelCenter(at: { x: number; z: number }, blockHeight: number, shift = 0, rise = 0): { x: number; z: number } {
  return { x: at.x + shift, z: at.z + PIN_GAP + blockHeight / 2 - rise }
}

/** The text turns toward the hill's ridge by at most this many degrees, and only for a hill that is clearly longer than wide. */
export const MAX_TURN = 14
const ELONGATED = 1.3

/**
 * The direction in which the high ground round (`cx`, `cz`) is longest, as the angle of the text that would run along it,
 * in degrees (positive runs toward +z, down the screen), softened so the lettering leans with the ridge instead of
 * following it: the principal axis of the ground above its own average within `radius`, weighted by height. A round
 * hill, or flat ground, gives 0.
 */
export function ridgeAngle(ground: (x: number, z: number) => number, cx: number, cz: number, radius = 130, step = 10): number {
  const pts: { x: number; z: number; h: number }[] = []
  let sum = 0
  for (let z = -radius; z <= radius; z += step) {
    for (let x = -radius; x <= radius; x += step) {
      if (x * x + z * z > radius * radius) continue
      const h = ground(cx + x, cz + z)
      pts.push({ x, z, h })
      sum += h
    }
  }
  if (pts.length === 0) return 0
  const mean = sum / pts.length
  let w = 0
  let mx = 0
  let mz = 0
  for (const p of pts) {
    const k = Math.max(0, p.h - mean)
    w += k
    mx += k * p.x
    mz += k * p.z
  }
  if (w <= 1e-9) return 0
  mx /= w
  mz /= w
  let sxx = 0
  let szz = 0
  let sxz = 0
  for (const p of pts) {
    const k = Math.max(0, p.h - mean)
    sxx += k * (p.x - mx) ** 2
    szz += k * (p.z - mz) ** 2
    sxz += k * (p.x - mx) * (p.z - mz)
  }
  sxx /= w
  szz /= w
  sxz /= w
  // Eigenvalues of the 2 x 2 covariance, and the angle of the long axis.
  const mid = (sxx + szz) / 2
  const spread = Math.sqrt(((sxx - szz) / 2) ** 2 + sxz * sxz)
  const long = mid + spread
  const short = mid - spread
  if (short <= 0 || long / short < ELONGATED * ELONGATED) return 0
  let deg = (0.5 * Math.atan2(2 * sxz, sxx - szz) * 180) / Math.PI // (-90, 90]: the long axis, read left to right
  if (deg > 90) deg -= 180
  if (deg <= -90) deg += 180
  return Math.max(-MAX_TURN, Math.min(MAX_TURN, deg * 0.5))
}

export type LabelGrid = {
  /** Ground-plane x, z of every vertex, flat. Heights are filled in from the terrain. */
  xz: Float32Array
  uv: Float32Array
  index: Uint16Array
  cols: number
  rows: number
}

/**
 * A flat grid of `width` x `height` world units centred on `center` and turned `angleDeg` on the ground, finely enough
 * (`step` units) that raising its vertices onto the terrain makes the text follow the hills. The text reads along the
 * grid's first axis; the top of the letters is toward the grid's far (north, at angle 0) side. Triangles face up.
 */
export function labelGrid(center: { x: number; z: number }, width: number, height: number, angleDeg: number, step: number): LabelGrid {
  const cols = Math.max(1, Math.ceil(width / step))
  const rows = Math.max(1, Math.ceil(height / step))
  const a = (angleDeg * Math.PI) / 180
  const dir = { x: Math.cos(a), z: Math.sin(a) }
  const up = { x: Math.sin(a), z: -Math.cos(a) }
  const xz = new Float32Array((cols + 1) * (rows + 1) * 2)
  const uv = new Float32Array((cols + 1) * (rows + 1) * 2)
  let n = 0
  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c <= cols; c++) {
      const s = c / cols
      const t = r / rows
      const u = (s - 0.5) * width
      const v = (t - 0.5) * height
      xz[n] = center.x + u * dir.x + v * up.x
      xz[n + 1] = center.z + u * dir.z + v * up.z
      uv[n] = s
      uv[n + 1] = t
      n += 2
    }
  }
  const index = new Uint16Array(cols * rows * 6)
  let k = 0
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * (cols + 1) + c
      const j = i + cols + 1
      index.set([i, i + 1, j + 1, i, j + 1, j], k)
      k += 6
    }
  }
  return { xz, uv, index, cols, rows }
}

const smooth = (t: number) => {
  const x = Math.min(1, Math.max(0, t))
  return x * x * (3 - 2 * x)
}

/**
 * Pixels per world unit in the wide shot of a 1344 x 768 window, measured at the farthest label (Vetagrande, 0.875; the
 * nearer ones read 0.94 to 0.98): the size the names were tuned at, so none of them is enlarged on that window.
 */
export const REF_PX_PER_UNIT = 0.87
/** The most a name is enlarged on a small window, so that it still stays clear of its neighbours. */
export const MAX_LABEL_BOOST = 1.5

/** Pixels per world unit at `distance` for a lens of `fov` degrees on a viewport `viewportHeight` px tall (true projection). */
export function pxPerUnit(distance: number, fov: number, viewportHeight: number): number {
  return viewportHeight / Math.max(2 * distance * Math.tan((fov * Math.PI) / 360), 1e-6)
}

/**
 * How much to enlarge a name, from the board's scale on screen (`pxPerUnit`): 1 at the reference window and anywhere larger,
 * growing as the window gets smaller so that the lettering is never smaller on screen than it is at 1344 x 768, up to `MAX_LABEL_BOOST`.
 */
export function labelBoost(scale: number): number {
  if (!Number.isFinite(scale)) return 1
  return Math.min(MAX_LABEL_BOOST, Math.max(1, REF_PX_PER_UNIT / Math.max(scale, 1e-6)))
}

/** The wide shot's lens for a 1344 x 768 window; other window shapes fit the board with another lens (see `capFraction`). */
export const REF_WIDE_FOV = 23.1

/**
 * How tall capitals of `cap` world units look, as a fraction of the viewport height, for a lens of `fov` degrees at
 * `distance`. Scaled by the wide shot's lens (0 if unknown) so that a window of another shape, which re-fits the board
 * with another lens, sees the same text as the reference one.
 */
export function capFraction(cap: number, distance: number, fov: number, wideFov: number): number {
  const seen = 2 * distance * Math.tan((fov * Math.PI) / 360)
  return (cap / Math.max(seen, 1e-6)) * (wideFov > 0 ? wideFov / REF_WIDE_FOV : 1)
}

/**
 * The name's capitals are 0.01 to 0.015 of the viewport height in the wide shot, which is the view now (a lens that
 * zooms in is only for `?zoom=on`). The text stays fully shown up to `start`, which no wide or medium shot reaches, and
 * is gone from `end`: only in a true close-up would it swamp the shot, and then the tack alone stays.
 */
export const GROUND_FADE = { start: 0.025, end: 0.04 }

/** 1 while the ground text is small on screen, easing to 0 as it grows past `GROUND_FADE`. */
export function groundTextAlpha(fraction: number): number {
  return 1 - smooth((fraction - GROUND_FADE.start) / (GROUND_FADE.end - GROUND_FADE.start))
}
