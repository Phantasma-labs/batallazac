import { describe, expect, it } from 'vitest'
import { GENERALS, generalOf } from './generals'

describe('the three generals', () => {
  it('are Ángeles, Villa and Natera, in that order', () => {
    expect(GENERALS.map((g) => g.id)).toEqual(['angeles', 'villa', 'natera'])
    expect(GENERALS.map((g) => g.name)).toEqual(['Felipe Ángeles', 'Pancho Villa', 'Pánfilo Natera'])
    expect(generalOf('villa').name).toBe('Pancho Villa')
  })

  it('each have army rows, 3 or 4 skills and 2 or 3 facts, every label in both languages', () => {
    for (const g of GENERALS) {
      expect(g.army.length).toBeGreaterThanOrEqual(1)
      expect(g.skills.length).toBeGreaterThanOrEqual(3)
      expect(g.skills.length).toBeLessThanOrEqual(4)
      expect(g.facts.length).toBeGreaterThanOrEqual(2)
      expect(g.facts.length).toBeLessThanOrEqual(3)
      for (const row of g.army) {
        expect(row.label.es).not.toBe('')
        expect(row.label.en).not.toBe('')
      }
    }
  })

  // Until the researched text is supplied nothing historical may be written from memory: delete this test when the real data lands.
  it('hold no history yet: every value, role, year, skill, part and fact is TODO', () => {
    const todo = { es: 'TODO', en: 'TODO' }
    for (const g of GENERALS) {
      expect(g.role).toEqual(todo)
      expect(g.years).toBe('TODO')
      expect(g.part).toEqual(todo)
      for (const row of g.army) expect(row.value).toEqual(todo)
      for (const s of g.skills) expect(s).toEqual(todo)
      for (const f of g.facts) expect(f).toEqual(todo)
    }
  })
})
