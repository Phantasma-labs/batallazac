import { describe, expect, it } from 'vitest'
import { applyKeyEvent } from './keyboard'

const ev = (type: 'keydown' | 'keyup', key: string, mods: Partial<{ ctrlKey: boolean; metaKey: boolean; altKey: boolean }> = {}) => ({
  type, key, ctrlKey: false, metaKey: false, altKey: false, ...mods,
})

describe('applyKeyEvent', () => {
  it('holds a pan key on keydown (case-insensitive) and releases it on keyup', () => {
    const held = new Set<string>()
    expect(applyKeyEvent(held, ev('keydown', 'W'), false)).toBe(true)
    expect([...held]).toEqual(['w'])
    applyKeyEvent(held, ev('keyup', 'w'), false)
    expect(held.size).toBe(0)
  })

  it('ignores keys that do not pan, without claiming them', () => {
    const held = new Set<string>()
    expect(applyKeyEvent(held, ev('keydown', 'q'), false)).toBe(false)
    expect(held.size).toBe(0)
  })

  it('ignores browser chords (Ctrl/Cmd/Alt) without claiming them', () => {
    for (const mods of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }]) {
      const held = new Set<string>()
      expect(applyKeyEvent(held, ev('keydown', 'd', mods), false)).toBe(false)
      expect(held.size).toBe(0)
    }
  })

  it('ignores keys typed into a form field', () => {
    const held = new Set<string>()
    expect(applyKeyEvent(held, ev('keydown', 'a'), true)).toBe(false)
    expect(held.size).toBe(0)
  })

  it('drops every held key when Cmd goes down, because macOS then never sends keyup for them', () => {
    const held = new Set<string>()
    applyKeyEvent(held, ev('keydown', 'd'), false)
    applyKeyEvent(held, ev('keydown', 'Meta', { metaKey: true }), false)
    expect(held.size).toBe(0)
  })

  it('drops held keys on any event that arrives with Cmd held', () => {
    const held = new Set<string>(['d'])
    applyKeyEvent(held, ev('keyup', 'd', { metaKey: true }), false)
    expect(held.size).toBe(0)
  })

  it('still releases a key on keyup when the event carries no modifiers', () => {
    const held = new Set<string>(['arrowright'])
    applyKeyEvent(held, ev('keyup', 'ArrowRight'), false)
    expect(held.size).toBe(0)
  })
})
