/**
 * A flat disc of `rings` rings of `segments` vertices round a centre vertex, lying in the XZ plane (y = 0) and centred on the origin,
 * with the texture coordinates of a square that just holds it (so the soft round glow texture of the glow discs fits). The ground
 * glows follow their group over the terrain: the caller sets each vertex's height every time the group moves.
 */
export function discGrid(radius: number, rings: number, segments: number): { positions: Float32Array; uv: Float32Array; index: Uint16Array } {
  const count = 1 + rings * segments
  const positions = new Float32Array(count * 3)
  const uv = new Float32Array(count * 2)
  uv.set([0.5, 0.5], 0)
  for (let r = 1; r <= rings; r++) {
    for (let s = 0; s < segments; s++) {
      const i = 1 + (r - 1) * segments + s
      const a = (s / segments) * Math.PI * 2
      const d = (r / rings) * radius
      positions[i * 3] = Math.cos(a) * d
      positions[i * 3 + 2] = Math.sin(a) * d
      uv[i * 2] = 0.5 + (Math.cos(a) * d) / (2 * radius)
      uv[i * 2 + 1] = 0.5 + (Math.sin(a) * d) / (2 * radius)
    }
  }
  const index: number[] = []
  for (let s = 0; s < segments; s++) index.push(0, 1 + s, 1 + ((s + 1) % segments))
  for (let r = 1; r < rings; r++) {
    for (let s = 0; s < segments; s++) {
      const a = 1 + (r - 1) * segments + s
      const b = 1 + (r - 1) * segments + ((s + 1) % segments)
      const c = a + segments
      const d = b + segments
      index.push(a, c, b, b, c, d)
    }
  }
  return { positions, uv, index: new Uint16Array(index) }
}
