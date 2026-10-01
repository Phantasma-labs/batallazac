const PAN_KEYS = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'])

export type KeyEventLike = { type: string; key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean }

/**
 * Updates the set of held pan keys (lowercased KeyEvent.key values) for one keyboard event.
 * Returns true when the event is a pan key the caller should preventDefault() (so the arrow keys
 * do not scroll the page).
 *
 * - Ctrl/Alt chords and typing in form fields are not pan input.
 * - Cmd: macOS never sends keyup for keys released while Cmd is down, so anything held would stick
 *   and the camera would drift forever. Any Cmd event therefore releases every held key.
 */
export function applyKeyEvent(held: Set<string>, e: KeyEventLike, typing: boolean): boolean {
  if (e.metaKey || e.key === 'Meta') {
    held.clear()
    return false
  }
  const key = e.key.toLowerCase()
  if (e.type === 'keyup') {
    held.delete(key)
    return false
  }
  if (e.ctrlKey || e.altKey || typing || !PAN_KEYS.has(key)) return false
  held.add(key)
  return true
}
