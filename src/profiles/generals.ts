import type { Bilingual } from '../timeline/model'

export type GeneralId = 'angeles' | 'villa' | 'natera'

/** A row of the army block: `value` is already a range string (an estimate, never a single precise figure). */
export type Stat = { label: Bilingual; value: Bilingual }

export type General = {
  id: GeneralId
  name: string
  role: Bilingual
  years: string
  army: Stat[] // differs per general: men, artillery or cavalry, command...
  skills: Bilingual[]
  part: Bilingual // his part at Zacatecas, tied to what the map shows
  facts: Bilingual[]
}

/**
 * What the profile panels say. Data only. The text is the approved `Research/General_Profiles_Content.md` (2026-10-29), where every
 * line carries its sources and a confidence tag. There is no ammunition row on purpose: no source gives an honest figure. Rows whose
 * figure does not exist (Ángeles's men, Natera's cavalry, the Dorados' headcount) are left out, not guessed. No quotations, no archive text.
 */
export const GENERALS: readonly General[] = [
  {
    id: 'angeles',
    name: 'Felipe Ángeles',
    role: { es: 'Jefe de artillería de la División del Norte', en: 'Chief of artillery, Division of the North' },
    years: '1868 – 1919',
    army: [
      { label: { es: 'Artillería', en: 'Artillery' }, value: { es: '30 cañones', en: '30 cannons' } },
      { label: { es: 'Mando', en: 'Command' }, value: { es: 'Toda la artillería de la División del Norte', en: 'All the artillery of the Division of the North' } },
    ],
    skills: [
      {
        es: 'Artillero de formación: ingresó al Colegio Militar a los 14 años y perfeccionó el cañón francés de 75 mm en Francia.',
        en: 'Trained artilleryman: entered the Military Academy at 14 and perfected the French 75 in France.',
      },
      { es: 'Matemático: enseñó matemáticas, mecánica analítica y balística.', en: 'Mathematician: taught mathematics, analytical mechanics and ballistics.' },
      { es: 'Estratega: coordinó la infantería y la artillería sobre todas las alturas a la vez.', en: 'Strategist: coordinated infantry and artillery on all the heights at once.' },
    ],
    part: {
      es: 'La noche anterior sacó los cañones de sus posiciones y los puso, ocultos, muy cerca de las defensas federales. A las 10:00 del 23 de junio un solo cañonazo abrió la batalla; hacia las 4 de la tarde se informó que a los federales se les había acabado la munición de artillería. Al caer la tarde mandó detener los fusilamientos de prisioneros.',
      en: 'The night before, he pulled his guns out of their positions and hid them very close to the federal defences. At 10:00 on 23 June a single shot opened the battle; by about 4 p.m. the federal artillery was reported out of ammunition. At dusk he ordered the executions of prisoners stopped.',
    },
    facts: [
      { es: 'Nació el 13 de junio de 1868 en Zacualtipán, Hidalgo.', en: 'Born 13 June 1868 in Zacualtipán, Hidalgo.' },
      {
        es: 'Fue director del Colegio Militar con Madero y estuvo preso con él en la Decena Trágica (febrero de 1913).',
        en: 'Director of the Military Academy under Madero; arrested with him in the Decena Trágica (February 1913).',
      },
      {
        es: 'Fue juzgado por un consejo de guerra en Chihuahua y fusilado el 26 de noviembre de 1919.',
        en: 'Court-martialled in Chihuahua and shot on 26 November 1919.',
      },
    ],
  },
  {
    id: 'villa',
    name: 'Pancho Villa',
    role: { es: 'Comandante de la División del Norte', en: 'Commander, Division of the North' },
    years: '1878 – 1923',
    army: [
      { label: { es: 'Hombres', en: 'Men' }, value: { es: '~20,000–25,000', en: '~20,000–25,000' } },
      { label: { es: 'Arma principal', en: 'Main arm' }, value: { es: 'Caballería, con cargas contra El Grillo', en: 'Cavalry, charging El Grillo' } },
      {
        label: { es: 'Apoyo', en: 'Support' },
        value: { es: 'Trenes y carros de sanidad, con médicos mexicanos y extranjeros', en: 'Railway hospital cars, with Mexican and foreign doctors' },
      },
    ],
    skills: [
      { es: 'Jinete y jefe de caballería: lideró cargas contra El Grillo.', en: 'Rider and cavalry leader: led charges at El Grillo.' },
      { es: 'Mueve ejércitos por ferrocarril: trenes de tropa, de artillería y de hospital.', en: 'Moves armies by rail: troop, artillery and hospital trains.' },
      { es: 'Carisma y osadía: atacó Zacatecas desobedeciendo a Carranza.', en: 'Charisma and daring: attacked Zacatecas against Carranza’s orders.' },
    ],
    part: {
      es: 'Carranza le ordenó ir a Saltillo y ceder 5,000 hombres a Natera; Villa avanzó con toda la División sobre Zacatecas. Llegó el 22 de junio y el 23 encabezó los asaltos de caballería sobre El Grillo mientras la artillería de Ángeles abría el camino. La victoria destruyó al ejército federal y lo separó de Carranza.',
      en: 'Carranza ordered him to Saltillo and to hand 5,000 men to Natera; Villa marched the whole Division on Zacatecas instead. He arrived on 22 June and on the 23rd led the cavalry assaults on El Grillo while Ángeles’s guns opened the way. The victory destroyed the federal army and split him from Carranza.',
    },
    facts: [
      {
        es: 'Nació José Doroteo Arango Arámbula el 5 de junio de 1878 en La Coyotada, Durango; lo llamaron «el Centauro del Norte».',
        en: 'Born José Doroteo Arango Arámbula on 5 June 1878 in La Coyotada, Durango; called “the Centaur of the North”.',
      },
      {
        es: 'Fue gobernador de Chihuahua (1913–14) e imprimió su propio papel moneda.',
        en: 'Governor of Chihuahua in 1913–14; he printed his own banknotes.',
      },
      { es: 'Murió emboscado en Parral el 20 de julio de 1923.', en: 'Killed in an ambush in Parral on 20 July 1923.' },
    ],
  },
  {
    id: 'natera',
    name: 'Pánfilo Natera',
    role: { es: 'General constitucionalista, División del Centro', en: 'Constitutionalist general, Division of the Centre' },
    years: '1882 – 1951',
    army: [
      { label: { es: 'Mando', en: 'Command' }, value: { es: 'División del Centro', en: 'Division of the Centre' } },
      { label: { es: 'Hombres', en: 'Men' }, value: { es: '~6,000 (junto con los hermanos Arrieta)', en: '~6,000 (together with the Arrieta brothers)' } },
    ],
    skills: [
      { es: 'Organizó una fuerza propia desde cero: se alzó con unos 70 rurales.', en: 'Built a force from nothing: rose with about 70 rurales.' },
      { es: 'Jefe zacatecano de la causa constitucionalista en su propio estado.', en: 'Zacatecan leader of the Constitutionalist cause in his own state.' },
      { es: 'Tenaz: volvió sobre Zacatecas y participó en la victoria de junio.', en: 'Persistent: came back to Zacatecas and shared in the June victory.' },
    ],
    part: {
      es: 'Carranza lo eligió para tomar Zacatecas antes que a Villa. Atacó con los Arrieta entre el 12 y el 14 de junio y Medina Barrón, ya reforzado, lo rechazó; Villa no le mandó la artillería ni la ayuda que pidió. El 23 de junio volvió a atacar junto a Villa y Urbina y, tras la victoria, fue comandante militar y gobernador provisional del estado.',
      en: 'Carranza chose him, not Villa, to take Zacatecas. He attacked with the Arrieta brothers on 12–14 June and Medina Barrón, by then reinforced, threw him back; Villa did not send the artillery and help he asked for. On 23 June he attacked again alongside Villa and Urbina and, after the victory, he was military commander and provisional governor of the state.',
    },
    facts: [
      { es: 'Campesino sin escuela, se unió a Madero en 1910.', en: 'A peasant with no schooling, he joined Madero in 1910.' },
      { es: 'Fue gobernador de Zacatecas de 1940 a 1944.', en: 'Governor of Zacatecas from 1940 to 1944.' },
      { es: 'Un municipio de Zacatecas lleva su nombre: General Pánfilo Natera.', en: 'A Zacatecas municipality bears his name: General Pánfilo Natera.' },
    ],
  },
]

export const generalOf = (id: GeneralId): General => GENERALS.find((g) => g.id === id)!
