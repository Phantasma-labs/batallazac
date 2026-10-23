import { createInstallPrompt } from './install'

/** The page's install prompt, created when the page loads so an early `beforeinstallprompt` is not missed. */
export const installPrompt = createInstallPrompt(
  typeof window === 'undefined' ? new EventTarget() : window,
  () => typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches,
)
