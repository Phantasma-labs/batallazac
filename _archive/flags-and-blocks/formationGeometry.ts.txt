import { ExtrudeGeometry, Shape, type BufferGeometry } from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { BAR, CHEVRON, EDGE, GUN, type Kind } from './formation'

type P = { x: number; y: number }

/** The three flat layers of a piece, seen from above: the dark outline, the cream edge, the painted top. */
export type Layers = { ink: BufferGeometry; cream: BufferGeometry; fill: BufferGeometry }

/** How far the cream edge and the painted top stand above the ink: from above they read as clean rings, with no sliver of side. */
const STEP = BAR.proud
/** Everything sinks this far into the ground, so a slope that cuts a piece looks like it stands in it. */
const SINK = 0.6
/** The chevron at the head of a force stands this much taller than a bar, so it catches the light and reads as the lead. */
const HEAD_RISE = 1.6

/** `points` (counter-clockwise) pushed outward by `d` with mitred corners: the outline of a shape. */
export function offsetPolygon(points: readonly P[], d: number): P[] {
  const n = points.length
  const normals = points.map((a, i) => {
    const b = points[(i + 1) % n]
    const dx = b.x - a.x, dy = b.y - a.y
    const l = Math.hypot(dx, dy) || 1
    return { x: dy / l, y: -dx / l } // outward for a counter-clockwise polygon
  })
  return points.map((p, i) => {
    const n0 = normals[(i + n - 1) % n], n1 = normals[i]
    const k = d / (1 + n0.x * n1.x + n0.y * n1.y)
    return { x: p.x + (n0.x + n1.x) * k, y: p.y + (n0.y + n1.y) * k }
  })
}

/** The arrowhead's outline in (heading, across), centred on its middle: a kite with a notch in its back, counter-clockwise. */
export const chevronOutline = (): P[] => [
  { x: CHEVRON.len / 2, y: 0 },
  { x: -CHEVRON.len / 2, y: CHEVRON.half },
  { x: CHEVRON.len / 2 - CHEVRON.len * CHEVRON.notch, y: 0 },
  { x: -CHEVRON.len / 2, y: -CHEVRON.half },
]

/** A flat shape stood up: drawn in (heading, across) and extruded `height` tall, with its base at y = -SINK and +X forward. */
function prism(outline: readonly P[], height: number, bevel: number): BufferGeometry {
  const shape = new Shape()
  outline.forEach((p, i) => (i === 0 ? shape.moveTo(p.x, p.y) : shape.lineTo(p.x, p.y)))
  shape.closePath()
  const g = new ExtrudeGeometry(shape, { depth: height + SINK - bevel * 2, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 2, steps: 1 })
  g.rotateX(-Math.PI / 2) // extrusion (z) becomes up (y)
  g.translate(0, bevel - SINK, 0)
  return g
}

/** A rounded slab `along` x `across` (x forward, z to the right) and `height` tall, its base sunk into the ground, centred at (cx, 0). */
function slab(along: number, across: number, height: number, radius: number, cx = 0): BufferGeometry {
  const g = new RoundedBoxGeometry(along, height + SINK, across, 3, Math.min(radius, along / 2 - 0.01, across / 2 - 0.01))
  return g.translate(cx, (height + SINK) / 2 - SINK, 0)
}

const cache = new Map<Kind, Layers>()
/** The layers of one piece of a force, shared by every formation. */
export function pieceGeometry(kind: Kind): Layers {
  const known = cache.get(kind)
  if (known) return known
  const c = BAR.cream
  let layers: Layers
  if (kind === 'bar') {
    layers = {
      ink: slab(BAR.depth + 2 * EDGE, BAR.len + 2 * EDGE, BAR.height, 1.4),
      cream: slab(BAR.depth + 2 * c, BAR.len + 2 * c, BAR.height + STEP, 1),
      fill: slab(BAR.depth, BAR.len, BAR.height + 2 * STEP, 0.7),
    }
  } else {
    // The barrel is a dark bar with a cream line along it, lower than the carriage.
    const mid = GUN.barrelFrom + GUN.barrelLen / 2
    const bh = BAR.height * 0.7
    layers = {
      ink: mergeGeometries([slab(GUN.depth + 2 * EDGE, GUN.len + 2 * EDGE, BAR.height, 1.4), slab(GUN.barrelLen, GUN.barrelWidth, bh, 1, mid)])!,
      cream: mergeGeometries([slab(GUN.depth + 2 * c, GUN.len + 2 * c, BAR.height + STEP, 1), slab(GUN.barrelLen - 3, GUN.barrelStripe, bh + STEP, 0.6, mid)])!,
      fill: slab(GUN.depth, GUN.len, BAR.height + 2 * STEP, 0.7),
    }
  }
  cache.set(kind, layers)
  return layers
}

let head: Layers | null = null
/** The chevron at the middle of an infantry front, centred on x = 0 (the mesh sits at `chevronX()`). */
export function chevronGeometry(): Layers {
  if (head) return head
  const outline = chevronOutline()
  head = {
    ink: prism(offsetPolygon(outline, EDGE), BAR.height + HEAD_RISE, 0),
    cream: prism(offsetPolygon(outline, BAR.cream), BAR.height + HEAD_RISE + STEP, 0),
    fill: prism(outline, BAR.height + HEAD_RISE + 2 * STEP, 0.35),
  }
  return head
}
