import type { Clock } from './clock'
import { DAY_END, DAY_START } from './model'

/** How long the finished day waits for a visitor before it starts over (a museum kiosk: the next visitor finds the start). */
export const IDLE_RESET_MS = 10_000

/** The input that counts as someone using the app. */
export const ACTIVITY = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'] as const

export type Playback = { readonly current: unknown; subscribe(listener: () => void): () => void }
export type Source = Pick<EventTarget, 'addEventListener' | 'removeEventListener'>

/** Several things that each keep the reset off while they are open (a film, a profile panel) as one: open when any is, heard when any changes. */
export function combine(...sources: Playback[]): Playback {
  return {
    get current() {
      return sources.map((s) => s.current).find(Boolean) ?? null
    },
    subscribe(listener) {
      const offs = sources.map((s) => s.subscribe(listener))
      return () => offs.forEach((off) => off())
    },
  }
}

/**
 * Sends the clock back to the start when the day has been over (20:00, stopped, no video open) for `ms` with no input. Any input
 * restarts the wait. Going to the start with `seek` also hands the camera back to the director, so it returns to the wide shot.
 * Returns a function that stops watching.
 */
export function watchIdleReset(clock: Clock, playback: Playback, source: Source = window, ms = IDLE_RESET_MS): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined
  const finished = () => clock.time >= DAY_END && !clock.playing && !playback.current

  const arm = () => {
    clearTimeout(timer)
    timer = undefined
    if (!finished()) return
    timer = setTimeout(() => {
      timer = undefined
      if (finished()) clock.seek(DAY_START)
    }, ms)
  }

  ACTIVITY.forEach((type) => source.addEventListener(type, arm, { passive: true }))
  const offClock = clock.subscribe(arm)
  const offPlayback = playback.subscribe(arm)
  arm()

  return () => {
    clearTimeout(timer)
    ACTIVITY.forEach((type) => source.removeEventListener(type, arm))
    offClock()
    offPlayback()
  }
}
