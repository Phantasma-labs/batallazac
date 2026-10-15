import { useSyncExternalStore } from 'react'
import { DAY_END, DAY_START } from './model'
import { BASE_RATE, STRETCHES, advanceClock, type Stretch } from './pacing'

/**
 * Clock minutes that pass per real second at 1x before the narration starts (the hours before 10:00 are squeezed on top of that). From
 * 10:00 the pace is set by the narration: each stretch between two lines lasts as long as its line plus a pause (`pacing.ts`), which
 * is about a minute for the whole day.
 */
export const MINUTES_PER_SECOND = BASE_RATE
export const SPEEDS = [0.5, 1, 2, 4] as const
export type Speed = (typeof SPEEDS)[number]

type State = { time: number; playing: boolean; speed: Speed }

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi)

/**
 * The timeline clock: one place, read every frame by the scene (`clock.time`, no re-render) and subscribed to by the
 * UI (`useClock`, which re-renders only when `time` crosses a whole minute, or the playing state or speed change).
 */
function createClock(start = DAY_START, stretches: readonly Stretch[] = STRETCHES) {
  let state: State = { time: start, playing: false, speed: 1 }
  const listeners = new Set<() => void>()
  let lastMinute = Math.floor(start)
  let seeks = 0

  const emit = () => listeners.forEach((l) => l())
  const set = (patch: Partial<State>) => {
    const next = { ...state, ...patch }
    const changed = next.playing !== state.playing || next.speed !== state.speed || Math.floor(next.time) !== lastMinute
    state = next
    lastMinute = Math.floor(next.time)
    if (changed) emit()
  }

  return {
    get time() {
      return state.time
    },
    get playing() {
      return state.playing
    },
    get speed() {
      return state.speed
    },
    /** Counts the times the viewer has moved the clock (scrubbed) or pressed play: lets the camera director take over again. */
    get seeks() {
      return seeks
    },
    /** Moves the clock (scrubbing). Does not stop playback. */
    seek(minutes: number) {
      seeks++
      set({ time: clamp(minutes, DAY_START, DAY_END) })
    },
    play() {
      seeks++
      // Pressing play at the end starts over.
      set({ playing: true, time: state.time >= DAY_END ? DAY_START : state.time })
    },
    pause() {
      set({ playing: false })
    },
    toggle() {
      if (state.playing) this.pause()
      else this.play()
    },
    setSpeed(speed: Speed) {
      set({ speed })
    },
    /** Called every frame with the real seconds since the last one. From 10:00 each stretch between two narration lines takes as long as its line and the pause after it (`pacing.ts`); before 10:00 the squeezed hours fly by. Stops at the end of the day. */
    tick(seconds: number) {
      if (!state.playing) return
      const time = advanceClock(state.time, seconds * state.speed, stretches)
      set({ time, playing: time < DAY_END })
    },
    subscribe(l: () => void) {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    snapshot: () => state,
    reset(time = DAY_START) {
      state = { time, playing: false, speed: 1 }
      lastMinute = Math.floor(time)
      emit()
    },
  }
}

export type Clock = ReturnType<typeof createClock>
export { createClock }

/** The app's clock. */
export const clock = createClock()

/** The clock's state for React; re-renders when the whole minute, the playing state or the speed changes. */
export function useClock(): State {
  return useSyncExternalStore(clock.subscribe, clock.snapshot)
}
