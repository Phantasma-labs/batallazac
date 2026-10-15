import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { cameraBus } from '../camera/bus'
import { manual } from '../camera/manual'
import { MAX_FRAME_DT } from '../camera/math'
import { clock } from './clock'
import { fx } from './fxTime'
import { EVENTS } from './events'
import { activeShotEvent } from './model'
import { playback } from '../video/playback'
import { narration } from '../audio/narration'
import { musicFrame } from '../audio/music'

/**
 * Runs the clock and points the camera: the camera goes to the shot of the latest event that names one, whether the
 * clock got there by playing or by scrubbing. Until the first such event it is on the wide shot. When the viewer takes the
 * camera (Esc, or a click), the director waits until they play or scrub again.
 */
export function Director() {
  const seen = useRef<{ event: string | null | undefined; seeks: number }>({ event: undefined, seeks: clock.seeks })

  useFrame((_, delta) => {
    const dt = Math.min(delta, MAX_FRAME_DT)
    if (clock.playing) fx.time += dt
    const before = clock.time
    clock.tick(dt)
    // A playable hotspot the clock went across stops it there and opens its video.
    playback.afterTick(before, clock.time)
    // The Spanish narration of the map (10:00 to 12:00): a line starts when the playing clock goes across its minute.
    narration.afterTick(before, clock.time)
    musicFrame(clock.playing, dt) // the subtle march under the map: only while the clock plays, so never under a video
    if (clock.seeks !== seen.current.seeks) {
      seen.current.seeks = clock.seeks
      seen.current.event = undefined // look again, even if the event is the same one
      cameraBus.directorOn = true
      manual.stopEditing() // playing or scrubbing takes the camera back from the panel: it follows the clock again
    }
    if (!cameraBus.directorOn || !cameraBus.focus) return
    const event = activeShotEvent(EVENTS, clock.time)
    const id = event?.id ?? null
    if (id === seen.current.event) return
    seen.current.event = id
    cameraBus.focus(event && event.shot !== 'wide' ? event.shot! : null)
  })

  return null
}
