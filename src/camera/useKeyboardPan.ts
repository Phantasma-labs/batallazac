import { useEffect, useRef } from 'react'
import { applyKeyEvent } from './keyboard'

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  )
}

/**
 * Tracks which pan keys (WASD / arrows) are held. The camera reads the set every frame, so
 * holding a key pans smoothly. The key rules live in `applyKeyEvent` (tested); this hook only wires
 * them to the window, and releases every held key when the window loses focus so the camera
 * cannot drift on its own.
 */
export function useKeyboardPan() {
  const keys = useRef<Set<string>>(new Set())

  useEffect(() => {
    const held = keys.current
    const onDown = (e: KeyboardEvent) => {
      if (applyKeyEvent(held, e, isTyping(e.target))) e.preventDefault()
    }
    const onUp = (e: KeyboardEvent) => {
      applyKeyEvent(held, e, false)
    }
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
