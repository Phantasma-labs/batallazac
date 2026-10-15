import { useEffect, useRef, useState } from 'react'
import { EVENTS } from '../timeline/events'
import { playback, usePlayback, type Open } from './playback'
import '../ui/video.css'
import { pick, t } from '../i18n'

/** The video that is open (see `playback`), over the map: a dimmed screen, the film in a letterboxed panel, and a way out. */
export function VideoOverlay() {
  const open = usePlayback()
  // A new key per opening: the same video shown twice running starts again from its first frame.
  return open?.hotspot.file ? <Player key={open.token} open={open} /> : null
}

function Player({ open }: { open: Open }) {
  const file = open.hotspot.file!
  const event = EVENTS.find((e) => e.id === open.hotspot.eventId)!
  const panel = useRef<HTMLDivElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const [ready, setReady] = useState(false)
  const [paused, setPaused] = useState(false)
  const [needsTap, setNeedsTap] = useState(false)

  const toggle = () => {
    const v = video.current
    if (!v) return
    if (v.paused) v.play().catch(() => setNeedsTap(true))
    else v.pause()
  }

  useEffect(() => {
    panel.current?.focus()
    // Sound is on: the browser may refuse to start it without a gesture, and then a big play button asks for one.
    video.current?.play().catch(() => setNeedsTap(true))
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        playback.close()
      } else if (e.code === 'Space' && (e.target as HTMLElement | null)?.tagName !== 'BUTTON') {
        e.preventDefault()
        toggle()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      // Back to the Play button, not to a tick the viewer clicked: Space on a focused tick would open its video again.
      document.querySelector<HTMLElement>('.tl-play')?.focus()
    }
  }, [])

  return (
    <div className="vo" role="dialog" aria-modal="true" aria-label={pick(event.title)}>
      <div className="vo-panel" ref={panel} tabIndex={-1}>
        <button className="vo-close" onClick={() => playback.close()} aria-label={t('Cerrar el video', 'Close the video')} title="Esc">
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <div className="vo-stage">
          <video
            ref={video}
            className="vo-video"
            src={file.src}
            poster={file.poster}
            playsInline
            preload="auto"
            onCanPlay={() => setReady(true)}
            onWaiting={() => setReady(false)}
            onPlaying={() => {
              setReady(true)
              setPaused(false)
              setNeedsTap(false)
            }}
            onPause={() => setPaused(true)}
            onEnded={() => playback.close()}
            onError={() => playback.close()}
            onClick={toggle}
          />
          {!ready && !needsTap && <div className="vo-spin" role="status" aria-label={t('Cargando el video', 'Loading video')} />}
          {(needsTap || paused) && (
            <button className="vo-big" onClick={toggle} aria-label={t('Reproducir el video', 'Play video')}>
              <svg viewBox="0 0 24 24" aria-hidden>
                <path d="M7 3.5v17l14-8.5z" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
