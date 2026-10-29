import type { Bilingual } from '../timeline/model'

export type GeneralId = 'angeles' | 'villa' | 'natera'

/** A row of the army block: `value` is already a range string (an estimate, never a single precise figure). */
export type Stat = { label: Bilingual; value: Bilingual }

export type General = {
  id: GeneralId
  name: string
  role: Bilingual
  years: string
  army: Stat[] // differs per general: men, artillery or cavalry, ammunition...
  skills: Bilingual[]
  part: Bilingual // his part at Zacatecas, tied to what the map shows
  facts: Bilingual[]
}

/**
 * What the profile panels say. Data only. Every number and sentence below is still 'TODO': the text is researched separately (against
 * `Research/La Batalla de Zacatecas (1914).md` and primary sources) and goes in here with its sources in comments. Nothing historical is
 * written from memory, no quotations, no archive text. The army rows' labels are structure only (which rows a general has is to be
 * confirmed with the figures).
 */
const TODO: Bilingual = { es: 'TODO', en: 'TODO' }
const men: Bilingual = { es: 'Hombres', en: 'Men' }
const ammunition: Bilingual = { es: 'Municiones', en: 'Ammunition' }

export const GENERALS: readonly General[] = [
  {
    id: 'angeles',
    name: 'Felipe Ángeles',
    role: TODO,
    years: 'TODO',
    army: [
      { label: men, value: TODO },
      { label: { es: 'Artillería', en: 'Artillery' }, value: TODO },
      { label: ammunition, value: TODO },
    ],
    skills: [TODO, TODO, TODO],
    part: TODO,
    facts: [TODO, TODO],
  },
  {
    id: 'villa',
    name: 'Pancho Villa',
    role: TODO,
    years: 'TODO',
    army: [
      { label: men, value: TODO },
      { label: { es: 'Caballería', en: 'Cavalry' }, value: TODO },
      { label: ammunition, value: TODO },
    ],
    skills: [TODO, TODO, TODO],
    part: TODO,
    facts: [TODO, TODO],
  },
  {
    id: 'natera',
    name: 'Pánfilo Natera',
    role: TODO,
    years: 'TODO',
    army: [
      { label: men, value: TODO },
      { label: { es: 'Caballería', en: 'Cavalry' }, value: TODO },
      { label: ammunition, value: TODO },
    ],
    skills: [TODO, TODO, TODO],
    part: TODO,
    facts: [TODO, TODO],
  },
]

export const generalOf = (id: GeneralId): General => GENERALS.find((g) => g.id === id)!
