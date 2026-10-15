import { LANG, byLang, type Lang } from '../i18n'
import { hm } from './model'

/** A spoken line of the map narration: the clock minute it starts at, and its file in public/ (relative to the page, like the videos). */
export type NarrationLine = { id: string; at: number; src: string; /** The length of the file, seconds (the test checks that each line ends before the next is due). */ seconds: number }

/** A line as it exists in each language: the Spanish file, and the English one (with its own length) when there is one. */
export type NarrationSource = NarrationLine & { en?: { src: string; seconds: number } }

/** The line in a language: the English file when the page is English and there is one, the Spanish one otherwise. */
export function lineIn(source: NarrationSource, lang: Lang): NarrationLine {
  const { id, at, en, ...es } = source
  return { id, at, ...byLang<{ src: string; seconds: number }>({ src: es.src, seconds: es.seconds }, en, lang) }
}

/**
 * The Spanish narration of the map from 10:00 to 19:30 (Ernesto Calderón, as in the Villa clip). Each line starts when the clock
 * crosses its minute while playing; scrubbing never starts one; and the day is paced by the lines (`pacing.ts`): the stretch up to the next line takes the line's length plus 2 s. Texts as the author wrote them on 2026-10-13 (Shots/MapNarration_ES):
 *  10:00 "Los cañones de Ángeles baten La Bufa y se dividen: la mitad toma Loreto, y los federales se repliegan hacia el centro."
 *  11:00 "Desde el noroeste, Villa avanza hacia la Sierpe. Se acerca el mediodía. La División del Norte llega al pie de la Sierpe."
 *  12:00 "A mediodía cae La Sierpe. Villa sigue sobre el Grillo y, con Natera, lo cerca durante horas."
 *  16:00 "Desde el suroeste, Natera dispara sobre el Grillo. Los federales se repliegan hacia el centro de la ciudad."
 *  17:00 "Villa y Natera toman el centro. Estalla una explosión en la ciudad, y los federales retroceden hacia La Bufa."
 *  18:00 "Las columnas de Villa y de Natera marchan sobre La Bufa, mientras los cañones de Ángeles la baten sin descanso."
 *  19:00 "A las siete de la tarde cae La Bufa. Los federales huyen por el sureste."   (the day ends at 19:30)
 */
export const NARRATION_SOURCES: readonly NarrationSource[] = [
  { id: 'n1', at: hm(10), src: 'audio/narration-map-es-v2/1.mp3', seconds: 7.12 },
  { id: 'n2', at: hm(11), src: 'audio/narration-map-es-v2/2.mp3', seconds: 6.88 },
  { id: 'n3', at: hm(12), src: 'audio/narration-map-es-v2/3.mp3', seconds: 6.59 },
  { id: 'n4', at: hm(16), src: 'audio/narration-map-es-v2/4.mp3', seconds: 6.14 },
  { id: 'n5', at: hm(17), src: 'audio/narration-map-es-v2/5.mp3', seconds: 6.32 },
  { id: 'n6', at: hm(18), src: 'audio/narration-map-es-v2/6.mp3', seconds: 6.64 },
  { id: 'n7', at: hm(19), src: 'audio/narration-map-es-v2/7.mp3', seconds: 4.24 },
]

/** The lines in the page's language (an English file dropped in as `en` on a source is used from then on; until then the Spanish voice speaks). */
export const NARRATION: readonly NarrationLine[] = NARRATION_SOURCES.map((s) => lineIn(s, LANG))
