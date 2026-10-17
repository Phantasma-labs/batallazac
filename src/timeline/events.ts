import { hm, type TimelineEvent, type Unit } from './model'

/**
 * 23 June 1914, one timeline. Every time is adjustable. `inferred` marks what the sources do not give (see
 * docs/superpowers/specs/2026-10-09-timeline-pins-devpanel-design.md).
 *
 * Stops set by the author on 2026-10-09: at 10:00 the guns open fire on La Bufa and Cerro de Loreto, Pánfilo Natera's army (in
 * the south-west) opens fire on El Grillo, and Villa's column (in the north-west camp) fires on La Sierpe as it advances, all
 * three from 10:00, the federals on the hill answering; at 11:00 (the guns set off at 10:30) half of the guns take Loreto and fire from it
 * on La Bufa, La Sierpe and El Grillo while the other half keep firing on La Bufa from Vetagrande until it falls; at noon Villa takes La
 * Sierpe, the guns stop firing on it, its federals are thrown back on El Grillo and Villa follows them there; at 16:00 Natera storms
 * El Grillo, which Villa has been closing in on, and the federals there (with those from La Sierpe) fall back on the city centre; at 17:00 they take the centre, with an explosion, and the
 * federals fall back on La Bufa; at 18:00 both armies attack La Bufa with the guns; at 19:00 La Bufa falls and the federals leave
 * by the south-east (bottom-right) corner of the map.
 *
 * Stops of a march, targets of an attack and the places of a blast are place ids (src/scene/places.ts). An event may carry
 * several marches (one per unit), attacks and blasts, and several events may share a minute: they are one tick on the strip, and
 * the caption shows the one written last. Marches and attacks may start before their event's tick (`startTime`) when the tick is
 * the moment they arrive; the federal army only ever fires back (its attacks are flashes at the soldiers' rifles, no arrows).
 *
 * An event with a `video` is a hotspot on the strip: the 00:00 film about Felipe Ángeles plays when Play is pressed before 10:00, and
 * the clock stops at 12:00, 16:00, 17:00 and 19:00 while their videos play (the files that exist are in src/video/videos.ts).
 * 10:00, 11:00 and 18:00 are information only.
 *
 * Changes of 2026-10-12 (the author): Ángeles' battery is one at the start and divides at 10:30, half of it taking Cerro de
 * Loreto by 11:00 while the other half stays at Vetagrande; and Villa, once he has taken La Sierpe at noon, goes straight on to El
 * Grillo (he is there by 12:30, firing on it until the assault at 16:00) instead of setting off from La Sierpe at 16:00.
 */

export const UNITS: Unit[] = [
  { id: 'angeles', track: 'angeles', start: 'angeles-guns', label: { es: 'Artillería de Ángeles', en: "Ángeles' artillery" } },
  // The two guns that stay at Vetagrande when the other three go to Loreto: they keep firing on La Bufa from there.
  { id: 'angeles-rear', track: 'angeles', start: 'angeles-rear', label: { es: 'Artillería de Ángeles (Vetagrande)', en: "Ángeles' artillery (Vetagrande)" } },
  { id: 'villa', track: 'villa', start: 'villa-troops', label: { es: 'División del Norte', en: 'División del Norte' } },
  // Pánfilo Natera's column, as the chip reads (the author, 2026-10-12): the División del Centro.
  { id: 'natera', track: 'villa', start: 'suroeste', label: { es: 'División del Centro', en: 'División del Centro' } },
  { id: 'fed-sierpe', track: 'federal', start: 'sierpe-federales', label: { es: 'Federales', en: 'Federals' } },
  { id: 'fed-grillo', track: 'federal', start: 'grillo-federales', label: { es: 'Federales', en: 'Federals' } },
  { id: 'fed-center', track: 'federal', start: 'loreto-federales', label: { es: 'Federales', en: 'Federals' } },
  { id: 'fed-bufa', track: 'federal', start: 'bufa-federales', label: { es: 'Federales', en: 'Federals' } },
]

export const EVENTS: TimelineEvent[] = [
  {
    id: 'felipe-angeles',
    track: 'angeles',
    time: hm(0),
    title: { es: 'Felipe Ángeles', en: 'Felipe Ángeles' },
    text: {
      es: 'El general Felipe Ángeles manda la artillería de la División del Norte; sus cañones abrirán la batalla a las 10:00.',
      en: "General Felipe Ángeles commands the División del Norte's artillery; his guns will open the battle at 10:00.",
    },
    video: { id: 'felipe-angeles', resumeAt: hm(10) },
    source: 'sourced',
  },
  {
    id: 'natera-opens-fire',
    track: 'villa',
    time: hm(10),
    title: { es: 'Natera abre fuego sobre el Cerro del Grillo', en: 'Natera opens fire on Cerro del Grillo' },
    text: {
      es: 'Desde el suroeste, los hombres de Pánfilo Natera abren fuego sobre el Cerro del Grillo y los federales responden desde sus parapetos.',
      en: "From the south-west, Pánfilo Natera's men open fire on Cerro del Grillo and the federals answer from behind their sandbags.",
    },
    attacks: [
      { unit: 'natera', target: 'elgrillo', endTime: hm(16, 40) },
      { unit: 'fed-grillo', target: 'suroeste', endTime: hm(16, 20) },
    ],
    source: 'inferred',
    note: "That Natera's army fires on El Grillo from the south-west from 10:00 is the author's; so is the federal answer.",
    noteEs: "Que el ejército de Natera dispare sobre El Grillo desde el suroeste a partir de las 10:00 es decisión del autor; también la respuesta federal.",
  },
  {
    id: 'villa-advances',
    track: 'villa',
    time: hm(10),
    title: { es: 'Villa avanza desde el noroeste', en: 'Villa advances from the north-west' },
    text: {
      es: 'La División del Norte sale de su campamento del noroeste y avanza sobre el Cerro de la Sierpe, disparando; los federales de la loma responden.',
      en: 'The División del Norte leaves its camp in the north-west and advances on Cerro de la Sierpe, firing as it goes; the federals on the hill answer.',
    },
    shot: 'march-villa-sierpe',
    marches: [{ unit: 'villa', path: ['villa-troops', 'sierpe'], endTime: hm(12) }],
    attacks: [
      { unit: 'villa', target: 'sierpe', endTime: hm(12) },
      { unit: 'fed-sierpe', target: 'villa-troops', endTime: hm(12) },
    ],
    source: 'inferred',
    note: "Where the camp stood, the route and the federals on La Sierpe are the author's, not from the sources; Villa arrives as he takes the hill, at noon.",
    noteEs: "El lugar del campamento, la ruta y los federales en La Sierpe son decisión del autor, no vienen de las fuentes; Villa llega cuando toma la loma, al mediodía.",
  },
  {
    id: 'angeles-opens-fire',
    track: 'angeles',
    time: hm(10),
    title: { es: 'El cañón da la señal', en: 'The cannon gives the signal' },
    text: {
      es: 'A las 10:00 en punto un cañonazo abre la batalla. Las baterías de Ángeles, en Vetagrande, disparan sobre La Bufa y el Cerro de Loreto.',
      en: "At 10:00 sharp a single cannon shot opens the battle. Ángeles' batteries at Vetagrande fire on La Bufa and Cerro de Loreto.",
    },
    shot: 'angeles-artillery',
    attacks: [
      // The whole battery fires until it divides, at 10:30.
      { unit: 'angeles', target: 'labufa', endTime: hm(10, 30) },
      { unit: 'angeles', target: 'loreto', endTime: hm(10, 30) },
      { unit: 'fed-bufa', target: 'vetagrande', endTime: hm(11) },
      // The federals on Loreto, under the first barrage, answer it until they fall back on the centre.
      { unit: 'fed-center', target: 'vetagrande', endTime: hm(11) },
    ],
    source: 'inferred',
    note: 'The 10:00 shot and the forty guns are sourced; that these guns aim at La Bufa and Cerro de Loreto, and the federal answer from La Bufa, are not.',
    noteEs: "El disparo de las 10:00 y los cuarenta cañones están documentados; que estos cañones apunten a La Bufa y al Cerro de Loreto, y la respuesta federal desde La Bufa, no.",
  },
  {
    id: 'angeles-advances',
    track: 'angeles',
    time: hm(11),
    title: { es: 'Los cañones toman el Cerro de Loreto', en: 'The guns take Cerro de Loreto' },
    text: {
      es: 'La mitad de los cañones de Ángeles, que se separó de la batería a las 10:30, toma el Cerro de Loreto, a medio camino de la ciudad, y desde allí abre fuego sobre La Bufa, La Sierpe y el Cerro del Grillo; la otra mitad sigue batiendo La Bufa desde Vetagrande. Los federales que guarnecían el cerro se repliegan hacia el centro de la ciudad.',
      en: "Half of Ángeles' guns, which split off from the battery at 10:30, take Cerro de Loreto, halfway to the city, and open fire from it on La Bufa, La Sierpe and Cerro del Grillo; the other half keep pounding La Bufa from Vetagrande. The federals who held the hill fall back on the city centre.",
    },
    shot: 'march-vetagrande-loreto',
    // The battery divides at 10:30: this half sets off then and is on Loreto at 11:00, the tick.
    marches: [
      { unit: 'angeles', path: ['angeles-guns', 'loreto'], startTime: hm(10, 30), endTime: hm(11) },
      // The federals who held Loreto fall back on the city centre as the guns take the hill (the author, 2026-10-13).
      { unit: 'fed-center', path: ['loreto-federales', 'centro-federales'], endTime: hm(11, 30) },
    ],
    attacks: [
      { unit: 'angeles', target: 'sierpe', endTime: hm(12) },
      { unit: 'angeles', target: 'labufa', endTime: hm(19) },
      { unit: 'angeles', target: 'elgrillo', endTime: hm(16, 20) },
      // The half that stays takes over from the first barrage as it fades (10:20 to 10:30), and fires on La Bufa from Vetagrande until it falls.
      { unit: 'angeles-rear', target: 'labufa', startTime: hm(10, 20), endTime: hm(19) },
      // ...and on Loreto too while the other half advances on it, until the hill is taken at 11:00.
      { unit: 'angeles-rear', target: 'loreto', startTime: hm(10, 20), endTime: hm(11) },
      { unit: 'fed-bufa', target: 'loreto', endTime: hm(17) },
    ],
    source: 'inferred',
    note: 'Sourced: a group of guns was advanced to Cerro de Loreto. The hours (the author divides the battery at 10:30), the targets and which guns stay are inferred.',
    noteEs: "Documentado: un grupo de cañones fue adelantado al Cerro de Loreto. Las horas (el autor divide la batería a las 10:30), los blancos y qué cañones se quedan son inferidos.",
  },
  {
    id: 'sierpe-taken',
    track: 'villa',
    time: hm(12),
    title: { es: 'Cae el Cerro de la Sierpe', en: 'Cerro de la Sierpe falls' },
    text: {
      es: 'Cerca del mediodía los revolucionarios toman la Sierpe, 300 metros al noroeste del Grillo, y rechazan a los federales hacia el Grillo. Con ella en su poder, la caída del Grillo es inevitable, y la columna de Villa avanza de inmediato sobre él.',
      en: "Near noon the revolutionaries take La Sierpe, 300 metres north-west of El Grillo, and throw the federals back on El Grillo. With it lost, the fall of El Grillo is inevitable, and Villa's column goes straight on to it.",
    },
    shot: 'march-villa-sierpe',
    marches: [
      { unit: 'fed-sierpe', path: ['sierpe-federales', 'grillo-sierpe'], endTime: hm(12, 30) },
      // Villa does not wait: he follows them to El Grillo as soon as he has La Sierpe, and keeps firing on it from there until the assault.
      { unit: 'villa', path: ['sierpe', 'elgrillo-nw'], endTime: hm(12, 30) },
    ],
    attacks: [
      { unit: 'villa', target: 'elgrillo', endTime: hm(16, 40) },
      // The federals thrown back on El Grillo, behind the garrison there, fire back at him.
      { unit: 'fed-sierpe', target: 'elgrillo-nw', startTime: hm(12, 30), endTime: hm(16, 20) },
    ],
    video: { id: 'villistas' },
    source: 'sourced',
    note: "La Sierpe falling near noon is sourced; the federals on it and their fall back on El Grillo are the author's, and so is Villa going straight on to El Grillo (2026-10-12).",
    noteEs: "La caída de La Sierpe hacia el mediodía está documentada; los federales en ella y su repliegue hacia El Grillo son decisión del autor, y también que Villa siga directo a El Grillo (2026-10-12).",
  },
  {
    id: 'grillo-taken',
    track: 'villa',
    time: hm(16),
    title: { es: 'Villa y Natera toman el Cerro del Grillo', en: 'Villa and Natera take Cerro del Grillo' },
    text: {
      es: 'La columna de Natera, desde el suroeste, asalta el Cerro del Grillo, que la de Villa ya cercaba desde el mediodía, y entre las dos lo toman; los federales, con los que huyeron de La Sierpe, se repliegan hacia el centro de la ciudad.',
      en: "Natera's column from the south-west storms Cerro del Grillo, which Villa's has been closing in on since noon, and together they take it; the federals, with those thrown back from La Sierpe, fall back on the city centre.",
    },
    shot: 'elgrillo',
    video: { id: 'natera' },
    marches: [
      { unit: 'natera', path: ['suroeste', 'elgrillo-sw'], endTime: hm(16, 20) },
      { unit: 'fed-grillo', path: ['grillo-federales', 'centro-federales-2'], startTime: hm(16, 20), endTime: hm(16, 55) },
      { unit: 'fed-sierpe', path: ['grillo-sierpe', 'centro-sierpe'], startTime: hm(16, 20), endTime: hm(16, 55) },
    ],
    attacks: [
      { unit: 'fed-grillo', target: 'elgrillo', startTime: hm(16, 20), endTime: hm(16, 50) },
      { unit: 'fed-sierpe', target: 'elgrillo', startTime: hm(16, 20), endTime: hm(16, 50) },
    ],
    source: 'inferred',
    note: "The dossier says El Grillo fell about 16:00; Olea and the British consul say about 13:00. Natera's army and the federal retreat to the centre are the author's.",
    noteEs: "El dossier dice que El Grillo cayó hacia las 16:00; Olea y el cónsul británico dicen que hacia las 13:00. El ejército de Natera y el repliegue federal al centro son decisión del autor.",
  },
  {
    id: 'centro-taken',
    track: 'villa',
    time: hm(17),
    title: { es: 'Villa y Natera toman el centro de Zacatecas', en: 'Villa and Natera take the centre of Zacatecas' },
    text: {
      es: 'A las cinco de la tarde las columnas de Villa y de Natera entran en el centro de Zacatecas y una enorme explosión sacude la ciudad.',
      en: "At five in the afternoon Villa's and Natera's columns enter the centre of Zacatecas and a huge explosion shakes the city.",
    },
    shot: 'cathedral',
    video: { id: 'zacatecas-centro' },
    marches: [
      { unit: 'villa', path: ['elgrillo-nw', 'centro-villa'], startTime: hm(16, 40), endTime: hm(17) },
      { unit: 'natera', path: ['elgrillo-sw', 'centro-natera'], startTime: hm(16, 40), endTime: hm(17) },
      { unit: 'fed-center', path: ['centro-federales', 'bufa-fed-1'], endTime: hm(17, 45) },
      { unit: 'fed-grillo', path: ['centro-federales-2', 'bufa-fed-2'], endTime: hm(17, 45) },
      { unit: 'fed-sierpe', path: ['centro-sierpe', 'bufa-fed-3'], endTime: hm(17, 45) },
    ],
    attacks: [
      { unit: 'villa', target: 'centro', startTime: hm(16, 40), endTime: hm(17) },
      { unit: 'natera', target: 'centro', startTime: hm(16, 40), endTime: hm(17) },
      { unit: 'fed-center', target: 'elgrillo', startTime: hm(16, 40), endTime: hm(17) },
    ],
    blasts: [{ at: 'centro', endTime: hm(17, 30) }],
    source: 'inferred',
    note: 'Placed by the author at 17:00, with the explosion: check the hour and the cause against the sources before publishing. After the explosion the federals fall back on La Bufa.',
    noteEs: "Colocado por el autor a las 17:00, con la explosión: verificar la hora y la causa en las fuentes antes de publicar. Tras la explosión los federales se repliegan a La Bufa.",
  },
  {
    id: 'angeles-bombards-bufa',
    track: 'angeles',
    time: hm(18),
    title: { es: 'Ángeles redobla el fuego sobre La Bufa', en: "Ángeles' guns pound La Bufa" },
    text: {
      es: 'Los cañones de Ángeles siguen batiendo La Bufa mientras las columnas de Villa y de Natera se acercan.',
      en: "Ángeles' guns keep pounding La Bufa as Villa's and Natera's columns close in.",
    },
    source: 'inferred',
  },
  {
    id: 'bufa-assault',
    track: 'villa',
    time: hm(18),
    title: { es: 'Villa y Natera atacan La Bufa', en: 'Villa and Natera attack La Bufa' },
    text: {
      es: 'Las columnas de Villa y de Natera marchan del centro sobre La Bufa mientras los cañones de Ángeles la baten; los federales responden con sus fusiles.',
      en: "Villa's and Natera's columns march from the centre on La Bufa while Ángeles' guns pound it; the federals answer with their rifles.",
    },
    shot: 'labufa',
    marches: [
      { unit: 'villa', path: ['centro-villa', 'bufa-villa'], endTime: hm(18, 40) },
      { unit: 'natera', path: ['centro-natera', 'labufa-sur'], endTime: hm(18, 40) },
    ],
    attacks: [
      { unit: 'villa', target: 'labufa', endTime: hm(19) },
      { unit: 'natera', target: 'labufa', endTime: hm(19) },
      { unit: 'fed-bufa', target: 'bufa-villa', startTime: hm(18, 30), endTime: hm(19) },
      { unit: 'fed-center', target: 'labufa-sur', startTime: hm(18, 30), endTime: hm(19) },
      { unit: 'fed-grillo', target: 'bufa-villa', startTime: hm(18, 30), endTime: hm(19) },
      { unit: 'fed-sierpe', target: 'labufa-sur', startTime: hm(18, 30), endTime: hm(19) },
    ],
    source: 'inferred',
    note: "The hours of the march and the assault on La Bufa are the author's; an earlier version of this timeline had La Bufa falling about 18:00.",
    noteEs: "Las horas de la marcha y del asalto a La Bufa son decisión del autor; una versión anterior de esta cronología tenía la caída de La Bufa hacia las 18:00.",
  },
  {
    id: 'bufa-taken',
    track: 'villa',
    time: hm(19),
    title: { es: 'Cae La Bufa y los federales huyen', en: 'La Bufa falls and the federals flee' },
    text: {
      es: 'A las siete de la tarde La Bufa cae en manos de los revolucionarios y los federales abandonan el campo por la esquina sureste.',
      en: 'At seven in the evening La Bufa falls to the revolutionaries and the federals leave the field by the south-east corner.',
    },
    shot: 'labufa',
    video: { id: 'la-bufa' },
    marches: [
      { unit: 'fed-bufa', path: ['bufa-federales', 'salida-1'], endTime: hm(19, 30) },
      { unit: 'fed-center', path: ['bufa-fed-1', 'salida-2'], endTime: hm(19, 30) },
      { unit: 'fed-grillo', path: ['bufa-fed-2', 'salida-3'], endTime: hm(19, 30) },
      { unit: 'fed-sierpe', path: ['bufa-fed-3', 'salida-4'], endTime: hm(19, 30) },
    ],
    source: 'inferred',
    note: 'Placed by the author: La Bufa taken at 19:00, the federals leaving past the south-east corner of the map (the east road).',
    noteEs: "Colocado por el autor: La Bufa tomada a las 19:00, los federales salen por la esquina sureste del mapa (el camino del este).",
  },
  {
    id: 'battle-over',
    track: 'villa',
    time: hm(20),
    title: { es: 'La batalla ha terminado', en: 'The battle is over' },
    text: {
      es: 'Al caer la noche Zacatecas es de los revolucionarios y el campo queda en silencio.',
      en: 'By nightfall Zacatecas is in the hands of the revolutionaries and the field falls silent.',
    },
    // The camera is back on the opening wide shot (the end of the camera track). No video here.
    source: 'inferred',
    note: "Placed by the author as the end of the day: the camera returns to the opening shot.",
    noteEs: "Colocado por el autor como final del día: la cámara vuelve al plano de apertura.",
  },
]
