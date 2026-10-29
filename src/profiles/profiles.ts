import { useSyncExternalStore } from 'react'
import { clock as appClock, type Clock } from '../timeline/clock'
import { playback as appPlayback } from '../video/playback'
import type { GeneralId } from './generals'

/** The profile that is open: which general, whether the day was playing when it opened, and a number that changes with every opening. */
export type OpenProfile = { id: GeneralId; resume: boolean; token: number }

/**
 * Which general's profile panel is open over the map, and the rules for opening and closing it, over a clock and the film playback
 * (neither knows anything about profiles). Opening stops the day (the clock, and with it the narration and the music, which follow it);
 * closing runs it on from the same minute if it was running. A panel never opens over a film or over another panel.
 */
export function createProfiles(clock: Clock, playback: { readonly current: unknown }) {
  let current: OpenProfile | null = null
  let tokens = 0
  const listeners = new Set<() => void>()
  const emit = () => listeners.forEach((l) => l())

  return {
    get current() {
      return current
    },
    snapshot: () => current,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    /** A tap on a general's button. */
    open(id: GeneralId) {
      if (current || playback.current) return
      const resume = clock.playing
      clock.pause()
      current = { id, resume, token: ++tokens }
      emit()
    },
    /** The X, Esc or the idle timeout: the day goes on as it was (a paused day stays paused; no seek, so it is the same minute). */
    close() {
      const open = current
      if (!open) return
      current = null
      emit()
      if (open.resume) clock.play()
    },
  }
}

/** The app's profiles, over the app's clock and film playback. */
export const profiles = createProfiles(appClock, appPlayback)

/** The open profile for React: re-renders when one opens or closes. */
export function usePanel(): OpenProfile | null {
  return useSyncExternalStore(profiles.subscribe, profiles.snapshot)
}
