import { CanvasTexture, SRGBColorSpace } from 'three'
import { hash01 } from './impactEffect'

const SIZE = 192

function canvas(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = c.height = SIZE
  return [c, c.getContext('2d')!]
}

function texture(c: HTMLCanvasElement): CanvasTexture {
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return t
}

const smokes: (CanvasTexture | undefined)[] = []
/** How many different smoke puffs there are: a plume of one repeated shape looks stamped. */
export const SMOKE_VARIANTS = 3
/**
 * A billow of gunsmoke drawn like a painted cumulus: a cluster of round lobes with soft, feathered edges, lit from above
 * (pale top, dark belly). The colour is neutral: each puff is tinted when it is drawn (orange where the fire lights it from
 * inside, blue-grey once it has cooled). Three shapes from fixed seeds, drawn once and shared.
 */
export function smokeTexture(variant = 0): CanvasTexture {
  const known = smokes[variant % SMOKE_VARIANTS]
  if (known) return known
  const [c, ctx] = canvas()
  const mid = SIZE / 2
  const lobes = 22
  const seed = (variant % SMOKE_VARIANTS) * 41.3
  for (let i = 0; i < lobes; i++) {
    const a = hash01(seed + i * 3.7) * Math.PI * 2
    const r = Math.sqrt(hash01(seed + i * 9.1 + 1)) * SIZE * 0.25
    const x = mid + Math.cos(a) * r, y = mid + Math.sin(a) * r * 0.82
    const rad = SIZE * (0.09 + hash01(seed + i * 5.3 + 2) * 0.12) * (1 - (r / (SIZE * 0.25)) * 0.3)
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.6, 'rgba(255,255,255,0.92)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, rad, 0, Math.PI * 2)
    ctx.fill()
  }
  // Shade it: pale on top, a dark belly, and a thin pale rim of light where the billows catch the sky.
  ctx.globalCompositeOperation = 'source-atop'
  const shade = ctx.createLinearGradient(SIZE * 0.4, SIZE * 0.15, SIZE * 0.6, SIZE * 0.88)
  shade.addColorStop(0, 'rgb(255,250,244)')
  shade.addColorStop(0.5, 'rgb(190,182,176)')
  shade.addColorStop(1, 'rgb(96,90,86)')
  ctx.fillStyle = shade
  ctx.fillRect(0, 0, SIZE, SIZE)
  smokes[variant % SMOKE_VARIANTS] = texture(c)
  return smokes[variant % SMOKE_VARIANTS]!
}

let flash: CanvasTexture | null = null
/** A muzzle or shell flash that reads on pale ground: an orange bloom with a white-hot heart and a few jagged rays. */
export function flashTexture(): CanvasTexture {
  if (flash) return flash
  const [c, ctx] = canvas()
  const mid = SIZE / 2
  ctx.translate(mid, mid)
  const rays = 9
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * Math.PI * 2 + hash01(i * 4.1) * 0.5
    const len = mid * (0.62 + hash01(i * 8.3) * 0.34)
    const w = 0.09 + hash01(i * 2.9) * 0.07
    const g = ctx.createLinearGradient(0, 0, Math.cos(a) * len, Math.sin(a) * len)
    g.addColorStop(0, 'rgba(255,214,110,0.95)')
    g.addColorStop(1, 'rgba(235,90,25,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.moveTo(Math.cos(a - w) * 4, Math.sin(a - w) * 4)
    ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len)
    ctx.lineTo(Math.cos(a + w) * 4, Math.sin(a + w) * 4)
    ctx.closePath()
    ctx.fill()
  }
  const bloom = ctx.createRadialGradient(0, 0, 0, 0, 0, mid * 0.72)
  bloom.addColorStop(0, 'rgba(255,255,240,1)')
  bloom.addColorStop(0.22, 'rgba(255,226,130,0.98)')
  bloom.addColorStop(0.55, 'rgba(244,128,34,0.7)')
  bloom.addColorStop(1, 'rgba(210,60,18,0)')
  ctx.fillStyle = bloom
  ctx.beginPath()
  ctx.arc(0, 0, mid * 0.72, 0, Math.PI * 2)
  ctx.fill()
  flash = texture(c)
  return flash
}

let glow: CanvasTexture | null = null
/** A shell's fireball in flight: a round hot heart fading through orange to red at the edge. */
export function glowTexture(): CanvasTexture {
  if (glow) return glow
  const [c, ctx] = canvas()
  const mid = SIZE / 2
  const g = ctx.createRadialGradient(mid, mid, 0, mid, mid, mid)
  g.addColorStop(0, 'rgba(255,255,236,1)')
  g.addColorStop(0.2, 'rgba(255,214,112,1)')
  g.addColorStop(0.5, 'rgba(240,112,28,0.8)')
  g.addColorStop(0.8, 'rgba(180,48,16,0.3)')
  g.addColorStop(1, 'rgba(120,30,10,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, SIZE, SIZE)
  glow = texture(c)
  return glow
}

let blob: CanvasTexture | null = null
/** A soft black blob: the shadow a shell throws on the ground. */
export function blobTexture(): CanvasTexture {
  if (blob) return blob
  const [c, ctx] = canvas()
  const mid = SIZE / 2
  const g = ctx.createRadialGradient(mid, mid, 0, mid, mid, mid)
  g.addColorStop(0, 'rgba(0,0,0,0.9)')
  g.addColorStop(0.5, 'rgba(0,0,0,0.5)')
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, SIZE, SIZE)
  blob = texture(c)
  return blob
}
