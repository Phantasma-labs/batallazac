import { useSyncExternalStore } from 'react'
import { t } from '../i18n'
import { installPrompt } from '../pwa/installPrompt'

/** Installs the page as an app; only there while the browser offers it (not on iOS, not once installed). */
export function InstallButton() {
  const canInstall = useSyncExternalStore(installPrompt.subscribe, installPrompt.snapshot)
  if (!canInstall) return null
  const label = t('Instalar la aplicación', 'Install the app')
  return (
    <button className="tl-install" onClick={() => void installPrompt.install()} aria-label={label} title={label}>
      <svg viewBox="0 0 24 24" aria-hidden>
        <path d="M12 3v11M7.5 10 12 14.5 16.5 10M5 19h14" />
      </svg>
    </button>
  )
}
