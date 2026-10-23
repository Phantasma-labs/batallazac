/** Registers the service worker (production builds only: the dev server has no /sw.js and a stale worker would hide edits). */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(new URL('sw.js', document.baseURI)).catch((error) => console.warn('service worker not registered', error))
  })
}
