/** The part of an object R2 sent back for a Range request: from `offset`, `length` bytes, or the last `suffix` bytes. */
export type R2Range = { offset?: number; length?: number; suffix?: number }

/**
 * The first and last byte (inclusive) of the part `range` names in an object of `size` bytes. R2 sends every key, some undefined
 * (`{ offset: 0, length: 1024, suffix: undefined }`), so test the values, not the keys.
 */
export function rangeBounds(range: R2Range, size: number): { start: number; end: number } {
  if (typeof range.suffix === 'number') {
    const start = Math.max(0, size - range.suffix)
    return { start, end: size - 1 }
  }
  const start = range.offset ?? 0
  const length = range.length ?? size - start
  return { start, end: Math.min(size, start + length) - 1 }
}

/** The `Content-Range` header of a 206 answer. */
export function contentRange(range: R2Range, size: number): string {
  const { start, end } = rangeBounds(range, size)
  return `bytes ${start}-${end}/${size}`
}
