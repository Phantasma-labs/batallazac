import { KICKER_RATIO, layoutLine, type LabelSpec, type PlacedGlyph } from './labels'

/** Serif system fonts only: nothing is fetched, and the capitals read as engraved on an old map. */
const FONT = '"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif'

/** Parchment-white letters on a near-black warm outline: the outline is what keeps them crisp over paper, hatching and glows alike. */
const FILL = '#fbf3dc'
const OUTLINE = '#1a1008'

/** Size of the name's letters on the canvas, px; the small line above is `KICKER_RATIO` of it. */
const NAME_PX = 144
const KICKER_TRACKING = 0.34
const CAP_RATIO = 0.68 // cap height / em for these serifs, when the browser cannot measure it
/** Outline width, in ems: thin, about 2 px on screen in the wide shot, half of it outside the letters' edge. */
const OUTLINE_EM = 0.12

export type DrawnLabel = {
  canvas: HTMLCanvasElement
  /** World units that one canvas pixel covers, so that the name's capitals are `spec.cap` tall. */
  worldPerPx: number
  width: number
  height: number
  /** Height of the text itself (small line, gap and name), without the margin round it, in canvas px. */
  block: number
}

type Line = { glyphs: PlacedGlyph[]; width: number; size: number; weight: number; baseline: number }

/** Draws a label's text on a transparent canvas: the small line over the name, centred, each letter outlined. */
export function drawLabel(spec: LabelSpec): DrawnLabel {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  const font = (weight: number, size: number) => `${weight} ${size}px ${FONT}`
  const capOf = (weight: number, size: number) => {
    ctx.font = font(weight, size)
    return ctx.measureText('H').actualBoundingBoxAscent || size * CAP_RATIO
  }
  const flow = (text: string, weight: number, size: number, tracking: number) => {
    ctx.font = font(weight, size)
    return layoutLine(text.toUpperCase(), size, tracking, (s) => ctx.measureText(s).width)
  }

  const nameCap = capOf(700, NAME_PX)
  const kickerPx = NAME_PX * KICKER_RATIO
  const kickerCap = capOf(700, kickerPx)
  const pad = NAME_PX * 0.5
  const gap = NAME_PX * 0.26

  const name = flow(spec.name, 700, NAME_PX, spec.tracking)
  const kicker = spec.kicker ? flow(spec.kicker, 700, kickerPx, KICKER_TRACKING) : null
  const lines: Line[] = []
  const block = nameCap + (kicker ? kickerCap + gap : 0)
  const height = Math.ceil(pad * 2 + block)
  const nameBase = height - pad
  lines.push({ ...name, size: NAME_PX, weight: 700, baseline: nameBase })
  if (kicker) lines.push({ ...kicker, size: kickerPx, weight: 700, baseline: nameBase - nameCap - gap })
  const width = Math.ceil(Math.max(...lines.map((l) => l.width)) + pad * 2)

  canvas.width = width
  canvas.height = height
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'
  ctx.lineJoin = 'round'
  ctx.miterLimit = 2
  for (const line of lines) {
    const left = (width - line.width) / 2
    ctx.font = font(line.weight, line.size)
    // A soft dark shadow first, then the solid outline, then the letters.
    ctx.save()
    ctx.fillStyle = OUTLINE
    ctx.globalAlpha = 0.5
    ctx.shadowColor = OUTLINE
    ctx.shadowBlur = line.size * 0.16
    for (const g of line.glyphs) ctx.fillText(g.ch, left + g.x, line.baseline)
    ctx.restore()
    ctx.strokeStyle = OUTLINE
    ctx.lineWidth = line.size * OUTLINE_EM
    for (const g of line.glyphs) ctx.strokeText(g.ch, left + g.x, line.baseline)
    ctx.fillStyle = FILL
    for (const g of line.glyphs) ctx.fillText(g.ch, left + g.x, line.baseline)
  }
  // Hairlines run out from the small line to the width of the name, so the two lock up like the title of an engraved map.
  if (kicker) {
    const reach = (name.width - kicker.width) / 2 - kickerPx * 0.8
    if (reach > NAME_PX * 0.25) {
      const y = lines[1].baseline - kickerCap / 2
      const nameLeft = (width - name.width) / 2
      ctx.lineCap = 'round'
      for (const [from, to] of [
        [nameLeft, nameLeft + reach],
        [width - nameLeft - reach, width - nameLeft],
      ]) {
        for (const [color, w] of [[OUTLINE, NAME_PX * 0.09], [FILL, NAME_PX * 0.025]] as const) {
          ctx.strokeStyle = color
          ctx.lineWidth = w
          ctx.beginPath()
          ctx.moveTo(from, y)
          ctx.lineTo(to, y)
          ctx.stroke()
        }
      }
    }
  }
  return { canvas, worldPerPx: spec.cap / nameCap, width, height, block }
}
