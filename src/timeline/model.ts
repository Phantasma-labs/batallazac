import type { Vec3 } from '../camera/math'

/**
 * Whose side a unit or an event is on: the colour of its trail and glow, and the chip of its caption. Ángeles' guns, Villa's
 * División del Norte (with Pánfilo Natera's army, which fights beside it) and the federal army.
 */
export type Track = 'angeles' | 'villa' | 'federal'
/** `inferred` events (positions, timings or targets the sources do not give) are marked in the UI. */
export type Source = 'sourced' | 'inferred'
export type Bilingual = { es: string; en: string }

/** A place on a march: the id of a pin, or a raw point on the board. */
export type PathStop = string | Vec3

/**
 * A unit (a group of soldiers, or Ángeles' guns) walks `path` from `startTime` (the event's `time` when absent) to `endTime`.
 * A march may start before its event's tick, when the tick is the moment the march arrives (Villa takes the city centre at 17:00
 * after setting off at 16:40).
 */
export type March = { unit: string; path: PathStop[]; endTime: number; startTime?: number }
/**
 * A unit fires on a place from `startTime` (the event's `time` when absent) to `endTime`. The soldiers or guns flash at their
 * muzzles; an attacking unit of Ángeles or Villa also draws a glowing arrow to the place, with fire and smoke where it lands (the
 * federal army only flashes: it fires back, it does not attack).
 */
export type Attack = { unit: string; target: string; endTime: number; startTime?: number }
/** An explosion at a place, from the event's `time` to `endTime`: the bang at once, the smoke fading out over the last minutes. */
export type Blast = { at: string; endTime: number }
/**
 * A video the event is a hotspot for (the files that exist are listed in src/video/videos.ts): `id` names it, and `resumeAt` is the
 * clock minute the day carries on from once it has played, the event's own `time` when absent (the 00:00 film resumes at 10:00).
 */
export type EventVideo = { id: string; resumeAt?: number }

export type TimelineEvent = {
  id: string
  track: Track
  /** Minutes after midnight, 23 June 1914. */
  time: number
  title: Bilingual
  text: Bilingual
  /** The camera goes to this shot when this becomes the latest event that names one. */
  shot?: string
  marches?: March[]
  attacks?: Attack[]
  blasts?: Blast[]
  video?: EventVideo
  source: Source
  note?: string
  /** The note in Spanish (shown when the page is in Spanish; the English one is the fallback). */
  noteEs?: string
}

/** A thing with a position over time. `start` is where it stands before its first march. */
export type Unit = { id: string; track: Track; start: PathStop; label: Bilingual }

/** The same march with its stops resolved to points (ground height included), ready to be walked. */
export type ResolvedMarch = { unit: string; start: number; end: number; path: Vec3[] }

/** First and last minute of the clock: the day starts at midnight, though nothing happens before 10:00 (see `SQUEEZES`). */
export const DAY_START = 0
export const DAY_END = 20 * 60

/** `hm(10, 5)` is 10:05. */
export const hm = (h: number, m = 0) => h * 60 + m

export function formatClock(minutes: number): string {
  const total = Math.round(minutes)
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi)

/** Length of a polyline. */
export function pathLength(path: readonly Vec3[]): number {
  let len = 0
  for (let i = 1; i < path.length; i++) len += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y, path[i].z - path[i - 1].z)
  return len
}

/** The point `fraction` (0..1) of the way along a polyline, by length. */
export function pointAlong(path: readonly Vec3[], fraction: number): Vec3 {
  if (path.length === 0) throw new Error('empty path')
  const f = clamp(fraction, 0, 1)
  if (path.length === 1 || f === 0) return { ...path[0] }
  const want = f * pathLength(path)
  let done = 0
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i]
    const seg = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)
    if (done + seg >= want) {
      const t = seg === 0 ? 0 : (want - done) / seg
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t }
    }
    done += seg
  }
  return { ...path[path.length - 1] }
}

/** How far through a march the clock is, 0..1 (constant speed). */
export function marchProgress(m: Pick<ResolvedMarch, 'start' | 'end'>, t: number): number {
  if (m.end <= m.start) return t >= m.end ? 1 : 0
  return clamp((t - m.start) / (m.end - m.start), 0, 1)
}

/**
 * Where a unit is at minute `t`: at `start` before its first march, at the end of the last finished march
 * between marches, and a point along the path during one. Marches are walked in time order.
 */
export function unitPosition(start: Vec3, marches: readonly ResolvedMarch[], unit: string, t: number): Vec3 {
  let at = start
  for (const m of [...marches].filter((x) => x.unit === unit).sort((a, b) => a.start - b.start)) {
    if (t < m.start) break
    const p = pointAlong(m.path, marchProgress(m, t))
    if (t < m.end) return p
    at = p
  }
  return at
}

/** The marches that are under way at `t` (for drawing their trails), with their progress. */
export function activeMarches<T extends Pick<ResolvedMarch, 'start' | 'end'>>(marches: readonly T[], t: number): { march: T; progress: number }[] {
  return marches.filter((m) => t >= m.start).map((m) => ({ march: m, progress: marchProgress(m, t) }))
}

/** The attacks showing at `t`, with how strongly (0..1: fades in and out over `fade` minutes at each end). */
export function activeAttacks(events: readonly TimelineEvent[], t: number, fade = 10): { attack: Attack; start: number; strength: number }[] {
  const out: { attack: Attack; start: number; strength: number }[] = []
  for (const e of events) {
    for (const a of e.attacks ?? []) {
      const start = a.startTime ?? e.time
      if (t < start || t > a.endTime) continue
      const edge = Math.min(t - start, a.endTime - t)
      out.push({ attack: a, start, strength: fade <= 0 ? 1 : clamp(edge / fade, 0, 1) })
    }
  }
  return out
}

/**
 * The explosions going at `t`: `age` is the minutes since the bang, `strength` 1 until `fade` minutes before the end and then
 * falling to 0 (there is no fade-in: a blast goes off at once).
 */
export function activeBlasts(events: readonly TimelineEvent[], t: number, fade = 8): { blast: Blast; start: number; age: number; strength: number }[] {
  const out: { blast: Blast; start: number; age: number; strength: number }[] = []
  for (const e of events) {
    for (const b of e.blasts ?? []) {
      if (t < e.time || t > b.endTime) continue
      out.push({ blast: b, start: e.time, age: t - e.time, strength: fade <= 0 ? 1 : clamp((b.endTime - t) / fade, 0, 1) })
    }
  }
  return out
}

/** The latest event at or before `t` that names a camera shot, or null (ties: the one written last). */
export function activeShotEvent(events: readonly TimelineEvent[], t: number): TimelineEvent | null {
  let best: TimelineEvent | null = null
  for (const e of events) {
    if (!e.shot || e.time > t) continue
    if (!best || e.time >= best.time) best = e
  }
  return best
}

/** The latest event of one lane at or before `t`, or null. */
export function latestEvent(events: readonly TimelineEvent[], track: Track, t: number): TimelineEvent | null {
  let best: TimelineEvent | null = null
  for (const e of events) {
    if (e.track !== track || e.time > t) continue
    if (!best || e.time >= best.time) best = e
  }
  return best
}

/** The first event strictly after `t`, or null. `before` gives the last strictly before it. */
export function nextEvent(events: readonly TimelineEvent[], t: number): TimelineEvent | null {
  let best: TimelineEvent | null = null
  for (const e of events) if (e.time > t && (!best || e.time < best.time)) best = e
  return best
}
export function previousEvent(events: readonly TimelineEvent[], t: number): TimelineEvent | null {
  let best: TimelineEvent | null = null
  for (const e of events) if (e.time < t && (!best || e.time > best.time)) best = e
  return best
}
