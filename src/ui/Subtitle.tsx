import { useSyncExternalStore } from 'react'
import { narration } from '../audio/narration'
import './subtitle.css'

/** The English subtitle of the map narration: shown while a (Spanish) line is spoken, only on the English page (the Spanish page has no `subtitle`). */
export function Subtitle() {
  const line = useSyncExternalStore(narration.subscribe, narration.lineSnapshot)
  return line?.subtitle ? (
    <p className="sub" role="status">
      {line.subtitle}
    </p>
  ) : null
}
