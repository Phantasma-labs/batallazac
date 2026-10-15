import { useEffect, useState } from 'react'
import './timeline.css'
import { t } from '../i18n'

/**
 * The map is made for a landscape screen from 1024 x 600 (a small tablet) up, best at 1280 x 720 or more. Below that the
 * lettering is too small to read. A browser's own bars take some of the screen height, so the notice only appears when the
 * window is portrait or under that, and the scene keeps running behind it.
 */
export const MIN_WIDTH = 1024
export const MIN_HEIGHT = 600
export const tooSmall = (w: number, h: number) => h > w || w < MIN_WIDTH || h < MIN_HEIGHT

export function OrientationNotice() {
  const [small, setSmall] = useState(() => tooSmall(window.innerWidth, window.innerHeight))
  useEffect(() => {
    const on = () => setSmall(tooSmall(window.innerWidth, window.innerHeight))
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  if (!small) return null
  return (
    <div className="orient-notice" role="alert">
      <div>
        {t('Usa una ventana horizontal', 'Please use a landscape window')}
        <small>{t(`Este mapa necesita al menos ${MIN_WIDTH} × ${MIN_HEIGHT} píxeles.`, `This map needs at least ${MIN_WIDTH} × ${MIN_HEIGHT} pixels.`)}</small>
      </div>
    </div>
  )
}
