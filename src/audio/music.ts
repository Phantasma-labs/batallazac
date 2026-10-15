import { narration } from './narration'

/**
 * The subtle march (the first 7 bars of the band take, looped, at about -26 LUFS; the level is in the file) that plays under the map (not under the videos). It follows the playing clock: it fades in when the map plays and
 * out when the clock stops (the pause button, a video opening), ducks under the narration, loops, and is silent while the sound is
 * switched off. The file is `public/audio/march.wav`; until it exists nothing plays and nothing complains.
 */
export const MUSIC_SRC = 'audio/march.wav'
/** How loud the march is on the map, and under a spoken line (0 to 1). */
export const MUSIC_LEVEL = 0.5
export const MUSIC_DUCKED = 0.2
/** Seconds to fade in or out. */
export const FADE_SECONDS = 1.2

/** The volume to go to: nothing unless the map is playing and the sound is on, a lower level under the narration. */
export function musicTarget(playing: boolean, muted: boolean, narrating: boolean): number {
  if (!playing || muted) return 0
  return narrating ? MUSIC_DUCKED : MUSIC_LEVEL
}

/** One step of a fade toward `target` at a constant rate (the full level in `FADE_SECONDS`). */
export function fadeStep(current: number, target: number, dt: number): number {
  const step = (MUSIC_LEVEL / FADE_SECONDS) * dt
  if (current < target) return Math.min(target, current + step)
  return Math.max(target, current - step)
}

let el: HTMLAudioElement | null = null
let volume = 0
let failed = false

/** Called every frame by the Director. */
export function musicFrame(playing: boolean, dt: number) {
  if (typeof Audio === 'undefined' || failed) return
  volume = fadeStep(volume, musicTarget(playing, narration.muted, narration.speaking), dt)
  if (!el) {
    if (volume <= 0 && !(playing && !narration.muted)) return
    try {
      el = new Audio(MUSIC_SRC)
      el.loop = true
      el.addEventListener('error', () => {
        failed = true
        el = null
      })
    } catch {
      failed = true
      return
    }
  }
  el.volume = Math.min(1, Math.max(0, volume))
  if (volume > 0 && el.paused) void el.play().catch(() => undefined)
  else if (volume <= 0 && !el.paused) el.pause()
}
