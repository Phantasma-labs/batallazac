import { useEffect, useRef } from 'react'
import { pick, t } from '../i18n'
import { generalOf } from './generals'
import { portraitOf } from './portraits'
import { profiles, usePanel, type OpenProfile } from './profiles'
import '../ui/profile.css'

/** The open profile (see `profiles`) over the map: a dimmed screen and a panel with the general's portrait clip and what is known of him. */
export function ProfilePanel() {
  const open = usePanel()
  // A new key per opening: the clip starts again from its first frame.
  return open ? <Panel key={open.token} open={open} /> : null
}

function Panel({ open }: { open: OpenProfile }) {
  const general = generalOf(open.id)
  const portrait = portraitOf(open.id)
  const panel = useRef<HTMLDivElement>(null)
  const video = useRef<HTMLVideoElement>(null)

  const replay = () => {
    const v = video.current
    if (!v) return
    v.currentTime = 0
    v.play().catch(() => undefined)
  }

  useEffect(() => {
    panel.current?.focus()
    // Silent, so the browser lets it start by itself; it plays once and rests on its last frame (no loop, nothing closes on `ended`).
    video.current?.play().catch(() => undefined)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        // The panel is modal: Tab goes round the close button and the text.
        const items = Array.from(panel.current?.querySelectorAll<HTMLElement>('button, [tabindex="0"]') ?? [])
        const active = document.activeElement
        if (!items.length) return
        if (e.shiftKey && (active === items[0] || active === panel.current)) {
          e.preventDefault()
          items[items.length - 1].focus()
        } else if (!e.shiftKey && active === items[items.length - 1]) {
          e.preventDefault()
          items[0].focus()
        }
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        profiles.close()
      }
      // Caught before it gets anywhere: Space and the arrows must not move the clock, nor Esc and WASD the camera, under the panel.
      e.stopPropagation()
    }
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      // Back to the button that opened it.
      document.querySelector<HTMLElement>(`[data-general="${open.id}"]`)?.focus()
    }
  }, [open.id])

  return (
    <div className="pf" role="dialog" aria-modal="true" aria-label={general.name}>
      <div className="pf-panel" ref={panel} tabIndex={-1}>
        <button className="pf-close" onClick={() => profiles.close()} aria-label={t('Cerrar el perfil', 'Close the profile')} title="Esc">
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>

        <div className="pf-top">
          <div className="pf-stage">
            {portrait?.src ? (
              <video ref={video} className="pf-video" src={portrait.src} poster={portrait.poster} muted playsInline preload="auto" onClick={replay} />
            ) : portrait?.poster ? (
              <img className="pf-video" src={portrait.poster} alt="" />
            ) : (
              <div className="pf-stage-none" aria-hidden>
                {general.name[0]}
              </div>
            )}
          </div>
          <div className="pf-id">
            <h2 className="pf-title">{general.name}</h2>
            <p className="pf-role">{pick(general.role)}</p>
            <p className="pf-years">{general.years}</p>
            <section className="pf-army-block">
              <h3>{t('Ejército', 'Army')}</h3>
              <dl className="pf-army">
                {general.army.map((row) => (
                  <div key={row.label.es}>
                    <dt>{pick(row.label)}</dt>
                    <dd>{pick(row.value)}</dd>
                  </div>
                ))}
              </dl>
            </section>
          </div>
        </div>

        <div className="pf-text" tabIndex={0} aria-label={t('Datos del general', 'About the general')}>
          <section>
            <h3>{t('Habilidades', 'Skills')}</h3>
            <ul className="pf-skills">
              {general.skills.map((s, i) => (
                <li key={i}>{pick(s)}</li>
              ))}
            </ul>
          </section>
          <section>
            <h3>{t('Su papel en Zacatecas', 'His part at Zacatecas')}</h3>
            <p>{pick(general.part)}</p>
          </section>
          <section>
            <h3>{t('Datos', 'Known facts')}</h3>
            <ul className="pf-facts">
              {general.facts.map((f, i) => (
                <li key={i}>{pick(f)}</li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  )
}
