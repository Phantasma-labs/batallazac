import type { Vec3 } from '../camera/math'
import { EVENTS, UNITS } from '../timeline/events'
import { drape } from './ground'
import type { PathStop, ResolvedMarch } from '../timeline/model'
import type { Board } from './useBoard'

/** Side colours: red for the revolutionaries, Ángeles' artillery included (the author, 2026-10-13: it was gold), blue for the federal army. */
export const COLORS: Record<string, string> = { angeles: '#e5483a', villa: '#e5483a', federal: '#5f93d6' }
/** Height above the terrain of the trails and arrows, so the hills' slopes do not cut them. */
export const LIFT = 1.4

export const stopPoint = (stop: PathStop, places: Board['places']): Vec3 => {
  if (typeof stop !== 'string') return stop
  const p = places.get(stop)
  if (!p) throw new Error(`no place "${stop}"`)
  return p
}

/** Every march in the timeline with its stops resolved and laid on the terrain. */
export function resolveMarches(board: Board): ResolvedMarch[] {
  return EVENTS.flatMap((e) =>
    (e.marches ?? []).map((m) => ({
      unit: m.unit,
      start: m.startTime ?? e.time,
      end: m.endTime,
      path: drape(m.path.map((s) => stopPoint(s, board.places)), board.groundY, 6, 0),
    })),
  )
}

const marchCache = new WeakMap<Board, ResolvedMarch[]>()
/** `resolveMarches`, once per board: the trails, the arrows, the guns, the soldiers and the glows all read the same list. */
export function marchesOf(board: Board): ResolvedMarch[] {
  let marches = marchCache.get(board)
  if (!marches) marchCache.set(board, (marches = resolveMarches(board)))
  return marches
}

export const colorOfUnit = (unitId: string) => COLORS[UNITS.find((u) => u.id === unitId)!.track]
