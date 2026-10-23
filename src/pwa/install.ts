/** The event Chromium fires when the page can be installed (not in lib.dom). */
type InstallEvent = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

/**
 * Whether the page can be installed now, and the way to ask. `target` is the window; `isStandalone` says the page already runs as an
 * installed app. Shaped like the other stores (`subscribe` / `snapshot`) for `useSyncExternalStore`.
 */
export function createInstallPrompt(target: EventTarget, isStandalone: () => boolean) {
  let offered: InstallEvent | null = null
  const listeners = new Set<() => void>()
  const set = (event: InstallEvent | null) => {
    offered = event
    for (const l of listeners) l()
  }

  target.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault() // keep it for our own button instead of the browser's mini-bar
    set(e as InstallEvent)
  })
  target.addEventListener('appinstalled', () => set(null))

  return {
    subscribe(listener: () => void): () => void {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    snapshot: (): boolean => offered !== null && !isStandalone(),
    async install(): Promise<void> {
      const event = offered
      if (!event) return
      set(null) // a prompt can be shown once
      await event.prompt()
      await event.userChoice
    },
  }
}
