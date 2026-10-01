import { useEffect, useRef } from 'react'

const PAN_KEYS = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'])

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  )
}

/**
 * Tracks which pan keys (WASD / arrows) are held. The camera reads the set every frame, so
 * holding a key pans smoothly. Browser chords (Ctrl/Cmd/Alt + key) and typing in form fields
 * are ignored, and every held key is released when the window loses focus so the camera
 * cannot drift on its own.
 */
export function useKeyboardPan() {
  const keys = useRef<Set<string>>(new Set())

  useEffect(() => {
    const held = keys.current
    const onDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return
      const key = e.key.toLowerCase()
      if (!PAN_KEYS.has(key)) return
      held.add(key)
      e.preventDefault() // keep the arrow keys from scrolling the page
    }
    const onUp = (e: KeyboardEvent) => held.delete(e.key.toLowerCase())
    const release = () => held.clear()

    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    window.addEventListener('blur', release)
    document.addEventListener('visibilitychange', release)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
      window.removeEventListener('blur', release)
      document.removeEventListener('visibilitychange', release)
      held.clear()
    }
  }, [])

  return keys
}
