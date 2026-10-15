import { useSyncExternalStore } from 'react'
import { clock as appClock, type Clock } from '../timeline/clock'
import { DAY_END, DAY_START } from '../timeline/model'
import { HOTSPOTS, stopCrossed, windowAt, type Hotspot } from './videos'

/**
 * The video that is open: its hotspot, whether the clock runs on when it ends, and a number that changes with every opening (so the
 * same video can be shown twice running).
 */
export type Open = { hotspot: Hotspot; resume: boolean; token: number }

/**
 * Which video is open over the map, and the rules for opening and closing it, over a clock (the clock itself knows nothing about
 * videos). The Director calls `afterTick` every frame; Play, Space and clicks on the strip go through `toggle` and `jump`; the overlay
 * calls `close` when the video ends, is skipped or fails. While a video is open everything else is ignored.
 */
export function createPlayback(clock: Clock, hotspots: readonly Hotspot[]) {
  let current: Open | null = null
  let tokens = 0
  const listeners = new Set<() => void>()
  const emit = () => listeners.forEach((l) => l())
  const show = (hotspot: Hotspot, resume: boolean) => {
    current = { hotspot, resume, token: ++tokens }
    emit()
  }

  /** Play from a stopped clock: the film of the stretch the clock is in (or a jump past it when it has no file), else just play. */
  const start = () => {
    if (clock.time >= DAY_END) clock.seek(DAY_START)
    const stretch = windowAt(clock.time, hotspots)
    if (!stretch) clock.play()
    else if (stretch.file) show(stretch, true)
    else {
      clock.seek(stretch.resumeAt)
      clock.play()
    }
  }

  return {
    get current() {
      return current
    },
    snapshot: () => current,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    /** The Play button and Space. */
    toggle() {
      if (current) return
      if (clock.playing) clock.pause()
      else start()
    },
    /** Called every frame with the clock's time before and after its tick: stops at a playable hotspot the tick went across. */
    afterTick(before: number, after: number) {
      if (current) return
      const hit = stopCrossed(before, after, hotspots)
      if (!hit) return
      clock.pause()
      clock.seek(hit.time)
      show(hit, true)
    },
    /** A click on the tick at `time`: its video if it has one (the clock then goes on as it was), else just a move of the clock. */
    jump(time: number) {
      if (current) return
      const hit = hotspots.find((h) => h.file && h.time === time)
      if (!hit) {
        clock.seek(time)
        return
      }
      const resume = clock.playing
      clock.pause()
      clock.seek(hit.time)
      show(hit, resume)
    },
    /** The video ended, was skipped or failed: the clock goes to where the hotspot resumes, and runs on if it should. */
    close() {
      const open = current
      if (!open) return
      current = null
      emit()
      clock.seek(open.hotspot.resumeAt)
      // At the end of the day there is nothing to run on to (play would start the day over).
      if (open.resume && open.hotspot.resumeAt < DAY_END) clock.play()
    },
  }
}

/** The app's playback, over the app's clock and the day's hotspots. */
export const playback = createPlayback(appClock, HOTSPOTS)

/** The open video for React: re-renders when one opens or closes. */
export function usePlayback(): Open | null {
  return useSyncExternalStore(playback.subscribe, playback.snapshot)
}
