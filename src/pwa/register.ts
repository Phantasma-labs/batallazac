/** Registers the service worker (production builds only: the dev server has no /sw.js and a stale worker would hide edits). */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(new URL('sw.js', document.baseURI))
      // Browsers look for a new worker on a navigation only about once a day; a kiosk that reloads rarely would run an old build.
      .then((registration) => registration.update().catch(() => {})) // offline: nothing to look for
      .catch((error) => console.warn('service worker not registered', error))
  })
}
