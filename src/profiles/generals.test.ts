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

  it('hold the approved text: no placeholder left, every line in both languages, no ammunition row', () => {
    for (const g of GENERALS) {
      const lines = [g.role, g.part, ...g.army.flatMap((r) => [r.label, r.value]), ...g.skills, ...g.facts]
      for (const line of lines) {
        expect(line.es.trim()).not.toBe('')
        expect(line.en.trim()).not.toBe('')
        expect(line.es).not.toMatch(/TODO/)
        expect(line.en).not.toMatch(/TODO/)
      }
      expect(g.years).toMatch(/^\d{4} – \d{4}$/)
      expect(g.army.some((r) => /munici|ammunition/i.test(r.label.es + r.label.en))).toBe(false)
    }
  })
})
