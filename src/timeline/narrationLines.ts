import { LANG, byLang, type Lang } from '../i18n'
import { hm } from './model'

/** A spoken line of the map narration: the clock minute it starts at, and its file in public/ (relative to the page, like the videos). */
export type NarrationLine = {
  id: string
  at: number
  src: string
  /** The length of the file, seconds (the test checks that each line ends before the next is due). */
  seconds: number
  /** The English subtitle shown while the (Spanish) line is spoken: only on the English page. */
  subtitle?: string
}

/** A line as it exists in each language: the Spanish file, and the English one (with its own length) when there is one. */
export type NarrationSource = Omit<NarrationLine, 'subtitle'> & { en?: { src: string; seconds: number }; subtitleEn?: string }

/** The line in a language: the English file when the page is English and there is one, the Spanish one otherwise. */
export function lineIn(source: NarrationSource, lang: Lang): NarrationLine {
  const { id, at, en, subtitleEn, ...es } = source
  return {
    id,
    at,
    ...byLang<{ src: string; seconds: number }>({ src: es.src, seconds: es.seconds }, en, lang),
    ...(lang === 'en' && subtitleEn ? { subtitle: subtitleEn } : {}),
  }
}

/**
 * The Spanish narration of the map from 10:00 to 20:00 (Ernesto Calderón, as in the Villa clip). Each line starts when the clock
 * crosses its minute while playing; scrubbing never starts one; and the day is paced by the lines (`pacing.ts`): the stretch up to the next line takes the line's length plus 2 s. Final pass, 2026-10-15 (Shots/MapNarration_ES, process_v3.py):
 *  10:00 "Los cañones de Ángeles baten La Bufa y se dividen: la mitad toma Loreto, y los federales se repliegan hacia el centro."
 *  11:00 "Desde el noroeste, la División del Norte avanza sobre la Sierpe, y los federales responden desde la loma. Se acerca el mediodía."
 *  12:00 "A mediodía cae La Sierpe. Villa sigue sobre el Grillo y, con Natera, lo cerca durante horas."
 *  16:00 "Cae el Cerro del Grillo. Los federales que lo defendían se repliegan hacia el centro de la ciudad."
 *  17:00 "El centro de la ciudad es de Villa y de Natera. Los federales se repliegan hacia La Bufa."
 *  18:00 "Las columnas de Villa y de Natera marchan sobre La Bufa, mientras los cañones de Ángeles la baten sin descanso."
 *  19:00 "Perdida La Bufa, los federales abandonan el campo por el sureste."
 *  19:30 "Zacatecas... la noche después de la batalla. La ciudad es de los revolucionarios, y el campo queda en silencio."   (the day ends at 20:00)
 */
export const NARRATION_SOURCES: readonly NarrationSource[] = [
  { id: 'n1', at: hm(10), src: 'audio/narration-map-es-v3/1.mp3', seconds: 7.12, subtitleEn: "Ángeles' guns pound La Bufa and divide: half take Loreto, and the federals fall back toward the center." },
  { id: 'n2', at: hm(11), src: 'audio/narration-map-es-v3/2.mp3', seconds: 7.56, subtitleEn: "From the northwest, the Division of the North advances on La Sierpe, and the federals answer from the ridge. Noon draws near." },
  { id: 'n3', at: hm(12), src: 'audio/narration-map-es-v3/3.mp3', seconds: 6.59, subtitleEn: "At midday La Sierpe falls. Villa presses on to El Grillo and, together with Natera, surrounds it for hours." },
  { id: 'n4', at: hm(16), src: 'audio/narration-map-es-v3/4.mp3', seconds: 5.55, subtitleEn: "Cerro del Grillo falls. The federals who held it fall back toward the center of the city." },
  { id: 'n5', at: hm(17), src: 'audio/narration-map-es-v3/5.mp3', seconds: 5.3, subtitleEn: "The center of the city belongs to Villa and Natera. The federals fall back toward La Bufa." },
  { id: 'n6', at: hm(18), src: 'audio/narration-map-es-v3/6.mp3', seconds: 6.64, subtitleEn: "The columns of Villa and Natera march on La Bufa, while Ángeles' guns pound it without rest." },
  { id: 'n7', at: hm(19), src: 'audio/narration-map-es-v3/7.mp3', seconds: 4.02, subtitleEn: "With La Bufa lost, the federals abandon the field to the southeast." },
  { id: 'n8', at: hm(19, 30), src: 'audio/narration-map-es-v3/8.mp3', seconds: 7.8, subtitleEn: "Zacatecas... the night after the battle. The city belongs to the revolutionaries, and the field falls silent." },
]

/** The lines in the page's language. 2026-10-15: the voice is Spanish on both pages and the English page shows `subtitleEn` while a line is spoken (the `en` audio mechanism stays, unused). */
export const NARRATION: readonly NarrationLine[] = NARRATION_SOURCES.map((s) => lineIn(s, LANG))
