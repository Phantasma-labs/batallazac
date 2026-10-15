import { describe, expect, it } from 'vitest'
import { byLang, detectLang, langFromBrowser } from './i18n'

describe('language of the browser', () => {
  it('is Spanish when any of its languages is Spanish, in any region', () => {
    expect(langFromBrowser(['es'])).toBe('es')
    expect(langFromBrowser(['es-MX', 'en-US'])).toBe('es')
    expect(langFromBrowser(['en-US', 'es-419'])).toBe('es')
    expect(langFromBrowser(['ES_ar'])).toBe('es')
  })
  it('is English for everything else, and when the browser says nothing', () => {
    expect(langFromBrowser(['en-US'])).toBe('en')
    expect(langFromBrowser(['fr-FR', 'de'])).toBe('en')
    expect(langFromBrowser(['est'])).toBe('en') // Estonian is not Spanish
    expect(langFromBrowser([])).toBe('en')
  })
})

describe('language of the page', () => {
  it('follows ?lang= before anything else', () => {
    expect(detectLang('?lang=en', 'es', ['es-MX'])).toBe('en')
    expect(detectLang('?lang=es', 'en', ['en-US'])).toBe('es')
  })
  it('follows the visitor\'s last choice before the browser', () => {
    expect(detectLang('', 'en', ['es-MX'])).toBe('en')
    expect(detectLang('', 'es', ['en-US'])).toBe('es')
  })
  it('ignores values that are not a language and falls back to the browser', () => {
    expect(detectLang('?lang=fr', 'xx', ['es-ES'])).toBe('es')
    expect(detectLang('?lang=fr', null, ['de'])).toBe('en')
    expect(detectLang('', null, ['en'])).toBe('en')
  })
})

describe('byLang', () => {
  it('gives the English one only on the English page, and only when there is one', () => {
    expect(byLang('a', 'b', 'en')).toBe('b')
    expect(byLang('a', 'b', 'es')).toBe('a')
    expect(byLang('a', undefined, 'en')).toBe('a')
  })
})
