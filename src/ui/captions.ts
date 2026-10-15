import type { TimelineEvent, Track } from '../timeline/model'
import { pick, t } from '../i18n'

/** The sides: the short name goes on the caption chips, the full one in labels for screen readers. */
export const LANES: readonly { track: Track; name: string; full: string }[] = [
  { track: 'angeles', name: 'Ángeles', full: 'Felipe Ángeles' },
  { track: 'villa', name: 'Villa', full: 'Pancho Villa' },
  { track: 'federal', name: 'Federales', full: t('Ejército federal', 'Federal army') },
]
export const laneOf = (track: Track) => LANES.find((l) => l.track === track)!

/** The event the camera is following: the latest one at or before `t` (ties: the one written last). */
export function focusEvent(events: readonly TimelineEvent[], t: number): TimelineEvent | null {
  let best: TimelineEvent | null = null
  for (const e of events) {
    if (e.time > t) continue
    if (!best || e.time >= best.time) best = e
  }
  return best
}

/** The first sentence of a text, for the one-line caption; the whole text is on hover. */
export function firstSentence(text: string): string {
  const m = /^[\s\S]*?[.!?](?=\s+[A-ZÁÉÍÓÚÑ¿¡"“']|\s*$)/.exec(text.trim())
  return (m ? m[0] : text).trim()
}

/**
 * The caption's one line of text: the first sentence, cut at a clause (or a word) with an ellipsis when it is longer than
 * `max` characters, so the plate stays tight and never breaks a word. The hover shows the whole text.
 */
export function captionText(text: string, max = 92): string {
  const s = firstSentence(text)
  if (s.length <= max) return s
  const head = s.slice(0, max)
  const clause = Math.max(head.lastIndexOf(', '), head.lastIndexOf('; '), head.lastIndexOf(': '))
  const at = clause >= max * 0.5 ? clause : head.lastIndexOf(' ')
  return `${head.slice(0, at > 0 ? at : max).replace(/[\s,;:]+$/, '')}…`
}

/** What a tick offers beyond its caption: a video that exists (`ready`), one that is planned but has no file yet (`coming`), or nothing (`none`). */
export type VideoKind = 'ready' | 'coming' | 'none'

/** Events that share a minute are one tick on the strip (they would sit on top of each other). */
export type TickGroup = { time: number; events: TimelineEvent[]; inferred: boolean; video: VideoKind }

/**
 * `inferred` is true only when every event in the group is: a tick is hollow only if nothing in it is sourced. `video` is the best of the
 * group's events (ready over coming over none); `ready` says whether the file of a video id exists.
 */
export function tickGroups(events: readonly TimelineEvent[], ready: (videoId: string) => boolean = () => false): TickGroup[] {
  const groups: TickGroup[] = []
  for (const e of events) {
    const video: VideoKind = !e.video ? 'none' : ready(e.video.id) ? 'ready' : 'coming'
    const g = groups.find((x) => x.time === e.time)
    if (g) {
      g.events.push(e)
      g.inferred = g.inferred && e.source === 'inferred'
      if (video === 'ready' || (video === 'coming' && g.video === 'none')) g.video = video
    } else groups.push({ time: e.time, events: [e], inferred: e.source === 'inferred', video })
  }
  return groups
}

/** The tooltip text of a tick: the time, then one line per event (inferred ones say so), then what its video is. */
export function tickTip(g: TickGroup, clockText: string): string {
  const lines = [clockText, ...g.events.map((e) => (e.source === 'inferred' ? `${pick(e.title)} ${t('(inferido)', '(inferred)')}` : pick(e.title)))]
  if (g.video === 'ready') lines.push('▶ Video')
  if (g.video === 'coming') lines.push(t('Video próximamente', 'Video coming soon'))
  return lines.join('\n')
}
