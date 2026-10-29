import { ACTIVITY, type Source } from '../timeline/idleReset'

/** How long a profile panel waits for input before it closes itself (a kiosk: a reader who walked off leaves the day to go on). */
export const PANEL_IDLE_MS = 90_000

type Profiles = { readonly current: unknown; subscribe(listener: () => void): () => void; close(): void }

/**
 * Closes the open profile panel after `ms` with no input; any input restarts the wait, and nothing runs while no panel is open. Closing
 * it resumes the day if it was playing (`profiles.close`). Returns a function that stops watching.
 */
export function watchPanelIdle(profiles: Profiles, source: Source = window, ms = PANEL_IDLE_MS): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined

  const arm = () => {
    clearTimeout(timer)
    timer = undefined
    if (!profiles.current) return
    timer = setTimeout(() => {
      timer = undefined
      profiles.close()
    }, ms)
  }

  ACTIVITY.forEach((type) => source.addEventListener(type, arm, { passive: true }))
  const offProfiles = profiles.subscribe(arm)
  arm()

  return () => {
    clearTimeout(timer)
    ACTIVITY.forEach((type) => source.removeEventListener(type, arm))
    offProfiles()
  }
}
