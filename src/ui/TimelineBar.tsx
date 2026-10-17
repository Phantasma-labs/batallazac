import { useEffect, useRef, useSyncExternalStore, type PointerEvent as ReactPointerEvent } from 'react'
import { narration } from '../audio/narration'
import { clock, useClock } from '../timeline/clock'
import { EVENTS } from '../timeline/events'
import { watchIdleReset } from '../timeline/idleReset'
import { DAY_END, DAY_START, formatClock, hm, nextEvent, previousEvent, type TimelineEvent } from '../timeline/model'
import { BAR_END, SQUEEZES, fromBar, toBar } from '../timeline/timeScale'
import { captionText, focusEvent, laneOf, tickGroups, tickTip } from './captions'
import { playback } from '../video/playback'
import { VIDEO_FILES } from '../video/videos'
import './timeline.css'
import { LANG, pick, switchLang, t } from '../i18n'

// The strip is drawn in bar minutes (see timeScale): the hours before the first shot and 12:00 to 16:00 are squeezed to an hour each.
const barPct = (bar: number) => `${(bar / BAR_END) * 100}%`
const pct = (minutes: number) => barPct(toBar(minutes))
// 13:00 to 15:00 have no label: they are inside the squeeze.
const HOURS = [0, 10, 11, 12, 16, 17, 18, 19, 20].map((h) => hm(h))
// One lane: events that share a minute are one tick. A tick is a video hotspot when one of its events names a video, ready when the file exists.
const TICKS = tickGroups(EVENTS, (id) => Object.hasOwn(VIDEO_FILES, id))

/** The hover and focus popover of a caption: what the caption leaves out (all the text, the note, sourced or inferred). */
function Popover({ event, id }: { event: TimelineEvent; id: string }) {
  const inferred = event.source === 'inferred'
  return (
    <div className={`tl-pop is-${event.track}`} role="tooltip" id={id}>
      <div className="tl-pop-meta">
        <span className="tl-chip">{laneOf(event.track).name}</span>
      </div>
      <p className="tl-pop-title">{pick(event.title)}</p>
      <p className="tl-pop-text">{pick(event.text)}</p>
      {(inferred || event.note) && <p className="tl-pop-note">{(LANG === 'es' ? event.noteEs : undefined) ?? event.note ?? t('Las fuentes no lo dan.', 'Not given by the sources.')}</p>}
    </div>
  )
}

/**
 * The timeline: one control row along the top (the clock and a strip to scrub: one lane of events, a tick jumps to its
 * event, hollow ticks are inferred, not sourced) and Play and the narration switch in the bottom-left corner, and one caption plate in the bottom-right corner for the latest event (what and
 * when, big; the rest on hover). Space plays and pauses; the arrow keys step from event to event.
 */
export function TimelineBar() {
  const { time, playing } = useClock()
  const muted = useSyncExternalStore(narration.subscribe, narration.snapshot)
  const strip = useRef<HTMLDivElement>(null)
  const primary = focusEvent(EVENTS, time)
  // At the start (and once the day is over) the Play button calls for attention: a bobbing arrow and a pulsing ring.
  const callPlay = !playing && (time <= DAY_START || time >= DAY_END)

  // A kiosk: ten seconds after the day ends with nobody at it, everything goes back to the start.
  useEffect(() => watchIdleReset(clock, playback), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (playback.current) return // a video is open: the overlay owns the keys
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return
      if (e.code === 'Space' && !(t && t.tagName === 'BUTTON')) {
        e.preventDefault()
        playback.toggle()
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        const to = e.key === 'ArrowRight' ? nextEvent(EVENTS, clock.time) : previousEvent(EVENTS, clock.time - 0.01)
        if (to) clock.seek(to.time)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const scrub = (e: ReactPointerEvent) => {
    const box = strip.current!.getBoundingClientRect()
    clock.seek(fromBar(Math.min(Math.max((e.clientX - box.left) / box.width, 0), 1) * BAR_END))
  }

  const now = formatClock(time)

  return (
    <section className="tl" aria-label={t('Cronología del 23 de junio de 1914', 'Timeline of 23 June 1914')}>
      <div className="tl-inner">
        <div className="tl-caps">
          <p className="tl-sr" aria-live="polite">
            {primary ? `${laneOf(primary.track).full}, ${formatClock(primary.time)}: ${pick(primary.title)}` : `${now}: ${t('antes de la batalla', 'before the battle')}`}
          </p>

          {primary ? (
            <article className={`tl-plate is-${primary.track}`} tabIndex={0} aria-describedby="tl-pop-main">
              <div className="tl-plate-body" key={primary.id}>
                <h3 className="tl-plate-title">
                  <span className="tl-chip">{laneOf(primary.track).name}</span>
                  <span className="tl-plate-name">{pick(primary.title)}</span>
                </h3>
                <p className="tl-plate-text">{captionText(pick(primary.text))}</p>
              </div>
              <span className={`tl-i${primary.source === 'inferred' ? ' is-inferred' : ''}`} aria-hidden>i</span>
              <Popover event={primary} id="tl-pop-main" />
            </article>
          ) : (
            <article className="tl-plate is-idle">
              <div className="tl-plate-body">
                <h3 className="tl-plate-title">
                  <span className="tl-chip">1914</span>
                  <span className="tl-plate-name">{t('Antes de la batalla', 'Before the battle')}</span>
                </h3>
                <p className="tl-plate-text">{t('Pulsa reproducir, o arrastra por la cronología, para seguir el 23 de junio hora por hora.', 'Press play, or drag along the timeline, to follow 23 June hour by hour.')}</p>
              </div>
            </article>
          )}
        </div>

        <div className="tl-controls">
          <div className="tl-clock">
            {now}
            <small>{t('23 de junio de 1914', '23 June 1914')}</small>
          </div>
          <div className="tl-track" ref={strip}>
            <div
              className="tl-scrub"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId)
                scrub(e)
              }}
              onPointerMove={(e) => e.buttons === 1 && scrub(e)}
            />
            <div className="tl-lane">
              {SQUEEZES.filter((s) => s.tag).map((s) => (
                <i key={s.from} className="tl-squeeze" style={{ left: pct(s.from), width: `calc(${pct(s.to)} - ${pct(s.from)})` }} />
              ))}
              <i className="tl-fill" style={{ width: pct(time) }} />
              {EVENTS.map((e) => {
                // The stretch of the day in which the event's armies are on the march.
                const marches = e.marches ?? []
                if (marches.length === 0) return null
                const start = Math.min(...marches.map((m) => m.startTime ?? e.time))
                const end = Math.max(...marches.map((m) => m.endTime))
                return <span key={`${e.id}-span`} className="tl-span" style={{ left: pct(start), width: `calc(${pct(end)} - ${pct(start)})` }} />
              })}
              {TICKS.map((g) => {
                const text = g.events.map((e) => pick(e.title)).join('; ')
                const isNow = g.events.some((e) => e.id === primary?.id)
                return (
                  <button
                    key={g.time}
                    className={`tl-tick${g.video === 'none' ? ' is-info' : ' is-video'}${g.video === 'coming' ? ' is-coming' : ''}${g.inferred ? ' is-inferred' : ''}${isNow ? ' is-now is-focus' : ''}`}
                    style={{ left: pct(g.time) }}
                    data-tip={tickTip(g, formatClock(g.time))}
                    aria-label={`${formatClock(g.time)} ${text}${g.video === 'ready' ? ' (video)' : g.video === 'coming' ? t(' (video próximamente)', ' (video coming soon)') : ''}`}
                    onClick={() => playback.jump(g.time)}
                  >
                    {g.video !== 'none' && <i className="tl-mark" aria-hidden />}
                  </button>
                )
              })}
            </div>
            <div className="tl-head" style={{ left: pct(time) }} />
            <input
              className="tl-range"
              type="range"
              min={0}
              max={BAR_END}
              step={1}
              value={Math.round(toBar(time))}
              aria-label={t('Hora del día', 'Time of day')}
              aria-valuetext={now}
              onChange={(e) => clock.seek(fromBar(Number(e.target.value)))}
            />
            <div className="tl-hours" aria-hidden>
              {HOURS.map((m) => (
                <span key={m} style={{ left: pct(m) }}>{formatClock(m)}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="tl-corner">
        <button className={`tl-play${callPlay ? ' is-calling' : ''}`} onClick={() => playback.toggle()} aria-label={playing ? t('Pausar', 'Pause') : t('Reproducir', 'Play')} title={t('Espacio', 'Space')}>
          {playing ? (
            <svg viewBox="0 0 24 24"><path d="M6 4h4v16H6zM14 4h4v16h-4z" /></svg>
          ) : (
            <svg viewBox="0 0 24 24"><path d="M7 3.5v17l14-8.5z" /></svg>
          )}
        </button>
        <button
          className={`tl-voice${muted ? ' is-off' : ''}`}
          onClick={() => narration.setMuted(!muted)}
          aria-label={muted ? t('Activar el sonido', 'Turn the sound on') : t('Silenciar el sonido', 'Turn the sound off')}
          aria-pressed={!muted}
          title={t('Sonido: narración y música', 'Sound: narration and music')}
        >
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M4 9v6h4l5 4V5L8 9z" />
            {muted ? <path d="M16 9l5 6M21 9l-5 6" className="tl-voice-x" /> : <path d="M16 8.5a5 5 0 010 7M18.5 6a8.5 8.5 0 010 12" className="tl-voice-x" />}
          </svg>
        </button>
        <button
          className="tl-lang"
          onClick={switchLang}
          aria-label={t('Cambiar el idioma a inglés', 'Switch the language to Spanish')}
          title={t('English', 'Español')}
          lang={LANG === 'es' ? 'en' : 'es'}
        >
          {LANG === 'es' ? 'EN' : 'ES'}
        </button>
        </div>
      </div>
    </section>
  )
}
