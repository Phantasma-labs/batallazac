import { LANG, byLang, type Lang } from '../i18n'
import { EVENTS } from '../timeline/events'
import type { TimelineEvent } from '../timeline/model'

/** A video in public/, by path relative to the page (like the models), and its poster picture shown until it can play. */
export type VideoFile = { src: string; poster?: string }

/** A video as it exists in each language: the Spanish file, and the English one when there is one (the English page plays the Spanish one otherwise). */
export type VideoSource = VideoFile & { en?: VideoFile }

/** The file of a source in a language (its poster too, falling back to the Spanish poster when the English cut has none). */
export function fileIn(source: VideoSource, lang: Lang): VideoFile {
  const { en, ...es } = source
  const file = byLang<VideoFile>(es, en, lang)
  return { src: file.src, poster: file.poster ?? es.poster }
}

/**
 * The videos that exist, by the id events name (`event.video.id`). A hotspot whose video is not listed here is a placeholder: it shows
 * on the strip and does nothing. To add one: `npm run optimize-video -- <master.mov> <id>`, then list `<id>` here.
 */
export const VIDEO_SOURCES: Record<string, VideoSource> = {
  'felipe-angeles': { src: 'videos/felipe-angeles.mp4', poster: 'videos/felipe-angeles.jpg' },
  villistas: { src: 'videos/villistas.mp4', poster: 'videos/villistas.jpg', en: { src: 'videos/villistas-en.mp4' } },
  natera: { src: 'videos/natera.mp4', poster: 'videos/natera.jpg' },
  'zacatecas-centro': { src: 'videos/zacatecas-centro.mp4', poster: 'videos/zacatecas-centro.jpg' },
}

/** The videos in the page's language (the sources of `VIDEO_SOURCES` resolved once, when the page loads). */
export const VIDEO_FILES: Record<string, VideoFile> = Object.fromEntries(Object.entries(VIDEO_SOURCES).map(([id, s]) => [id, fileIn(s, LANG)]))

/**
 * An event with a video, seen from the playback side: when it is, where the clock goes once its video has played, and the file (null
 * for a placeholder).
 */
export type Hotspot = { eventId: string; videoId: string; time: number; resumeAt: number; file: VideoFile | null }

export function hotspotsOf(events: readonly TimelineEvent[], files: Readonly<Record<string, VideoFile>> = VIDEO_FILES): Hotspot[] {
  const out: Hotspot[] = []
  for (const e of events) {
    if (!e.video) continue
    out.push({
      eventId: e.id,
      videoId: e.video.id,
      time: e.time,
      resumeAt: e.video.resumeAt ?? e.time,
      file: Object.hasOwn(files, e.video.id) ? files[e.video.id] : null,
    })
  }
  return out
}

/** The hotspots of the day. */
export const HOTSPOTS: readonly Hotspot[] = hotspotsOf(EVENTS)

/**
 * The playable hotspot the clock went past or reached between `before` (not included: a clock that sets off from a hotspot does not meet
 * it again) and `after`, the earliest when a long frame crossed several; null when none.
 */
export function stopCrossed(before: number, after: number, hotspots: readonly Hotspot[]): Hotspot | null {
  let best: Hotspot | null = null
  for (const h of hotspots) if (h.file && h.time > before && h.time <= after && (!best || h.time < best.time)) best = h
  return best
}

/**
 * The hotspot whose stretch `time` is in, from its start up to (not including) where it resumes: Play pressed there opens it (the film
 * at 00:00 covers 00:00 to 10:00). Hotspots that resume where they play have an empty stretch. Placeholders count: the caller skips them.
 */
export function windowAt(time: number, hotspots: readonly Hotspot[]): Hotspot | null {
  return hotspots.find((h) => h.time <= time && time < h.resumeAt) ?? null
}
