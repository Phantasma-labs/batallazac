import { useSyncExternalStore } from 'react'
import type { Vec3 } from './math'
import { MANUAL_SHOTS, parseShots, type ManualShot, type ShotDof, type ShotKey, type Shots } from './manualShots'

export type ManualState = {
  /** The hand-placed cameras: the committed ones, with the dev panel's drafts over them. */
  shots: Shots
  /** The shot the camera is held on while it is being placed, or null (the director has the camera). */
  editing: ShotKey | null
  /** Whether the dev panel is showing. */
  open: boolean
}

/** A change to a shot: any of its numbers, position and dof partly. */
export type ShotPatch = Partial<Omit<ManualShot, 'position' | 'dof'>> & { position?: Partial<Vec3>; dof?: Partial<ShotDof> }

type Options = {
  committed: Shots
  /** Reads and writes the drafts as text (the dev panel keeps them in localStorage so a refresh does not lose them). */
  load?: () => string | null
  save?: (text: string) => void
  open?: boolean
}

/**
 * The hand-placed cameras and what the dev panel is doing with them, in one place read every frame by the camera
 * (`snapshot()`, no re-render) and subscribed to by the panel (`useManual`). Snapshots are immutable: a change makes a new one.
 */
export function createManualStore({ committed, load, save, open = true }: Options) {
  let state: ManualState = { shots: { ...committed, ...parseShots(load?.() ?? null) }, editing: null, open }
  const listeners = new Set<() => void>()

  const set = (patch: Partial<ManualState>) => {
    const next = { ...state, ...patch }
    if (next.shots === state.shots && next.editing === state.editing && next.open === state.open) return
    const shotsChanged = next.shots !== state.shots
    state = next
    if (shotsChanged) save?.(JSON.stringify({ shots: state.shots }))
    listeners.forEach((l) => l())
  }

  return {
    snapshot: () => state,
    subscribe(l: () => void) {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    /** Holds the camera on a shot to place it. One that is not placed yet starts where the camera is now (`seed`). */
    select(key: ShotKey, seed: ManualShot | null) {
      if (state.shots[key]) return set({ editing: key })
      if (seed) set({ editing: key, shots: { ...state.shots, [key]: seed } })
    },
    update(key: ShotKey, patch: ShotPatch) {
      const was = state.shots[key]
      if (!was) return
      const next: ManualShot = {
        ...was,
        ...patch,
        position: { ...was.position, ...patch.position },
        dof: { ...was.dof, ...patch.dof },
      }
      set({ shots: { ...state.shots, [key]: next } })
    },
    /** Hands the camera back to the director (the wide shot until the clock is played or scrubbed). */
    stopEditing: () => set({ editing: null }),
    /** Hides the panel; the camera leaves the shot it was being placed on. */
    close: () => set({ open: false, editing: null }),
    show: () => set({ open: true }),
    /** Back to the committed shot (or none), and the camera stops being held on it. */
    reset(key: ShotKey) {
      const shots = { ...state.shots }
      if (committed[key]) shots[key] = committed[key]
      else delete shots[key]
      set({ shots, editing: state.editing === key ? null : state.editing })
    },
  }
}

export type ManualStore = ReturnType<typeof createManualStore>

// The drafts live in localStorage in development only (the shipped app reads just the committed table). Bump the number
// when new numbers are committed to MANUAL_SHOTS, so a stale draft cannot hide them.
const DRAFTS_KEY = 'zacatecas.cameraDrafts.v9' // v1 to v8 (v9: Loreto 11:00, La Sierpe 11:30-12:00, a 13:00 key south) (v6: the 12:30 key became 16:00 again, equal to the 11:30 one) (v3: the key at 16:00 moved to 12:30, v4: the key at 12:00 moved to 11:30, both 2026-10-13): the drafts before the first and the second set of seven shots were committed (2026-10-11)
const guarded = <T>(fn: () => T, fallback: T): T => {
  try {
    return fn()
  } catch {
    return fallback // storage can be blocked (private window, previews)
  }
}

export const manual: ManualStore = createManualStore({
  committed: MANUAL_SHOTS,
  open: import.meta.env.DEV,
  load: import.meta.env.DEV ? () => guarded(() => localStorage.getItem(DRAFTS_KEY), null) : undefined,
  save: import.meta.env.DEV ? (text) => guarded(() => localStorage.setItem(DRAFTS_KEY, text), undefined) : undefined,
})

/** The store's state for React. */
export function useManual(): ManualState {
  return useSyncExternalStore(manual.subscribe, manual.snapshot)
}
