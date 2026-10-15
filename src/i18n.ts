/**
 * The page's language. Spanish is the main one and English the other. It is chosen, in this order, by `?lang=es|en` (a link that
 * forces one), by the visitor's last choice with the ES/EN switch, and by the browser's languages: Spanish if any of them is
 * Spanish, English otherwise. Events and units carry both texts (`{ es, en }`); the strings of the interface are written at the
 * place they are used with `t`.
 */
export type Lang = 'es' | 'en'

export const LANG_KEY = 'toma.lang'

const asLang = (value: string | null | undefined): Lang | null => (value === 'es' || value === 'en' ? value : null)

/** Spanish when any of the browser's languages is Spanish (es, es-MX, es-419...), English otherwise (also when it lists none). */
export function langFromBrowser(languages: readonly string[]): Lang {
  return languages.some((l) => /^es(-|_|$)/i.test(l)) ? 'es' : 'en'
}

export function detectLang(search: string, stored: string | null, languages: readonly string[]): Lang {
  return asLang(new URLSearchParams(search).get('lang')) ?? asLang(stored) ?? langFromBrowser(languages)
}

const readStored = (): string | null => {
  try {
    return localStorage.getItem(LANG_KEY)
  } catch {
    return null
  }
}

const browserLanguages = (): readonly string[] =>
  typeof navigator === 'undefined' ? [] : navigator.languages?.length ? navigator.languages : navigator.language ? [navigator.language] : []

/** Chosen once, when the page loads. (The unit tests run without a `window`: Spanish.) */
export const LANG: Lang =
  typeof window === 'undefined' ? 'es' : detectLang(window.location.search, readStored(), browserLanguages())

/** The text in the page's language. */
export const t = (es: string, en: string): string => (LANG === 'es' ? es : en)

/** The text of a `{ es, en }` pair in the page's language. */
export const pick = (text: { es: string; en: string }): string => text[LANG]

/** What to use in the page's language: the English one when it exists and the page is English, the Spanish one otherwise. */
export const byLang = <T>(es: T, en?: T, lang: Lang = LANG): T => (lang === 'en' && en !== undefined ? en : es)

/** The title of the page, as the tab shows it. */
export const PAGE_TITLE = t('La Toma de Zacatecas', 'The Taking of Zacatecas')

if (typeof document !== 'undefined') {
  document.documentElement.lang = LANG
  document.title = PAGE_TITLE
}

/** Switch to the other language: remembered, and the page reloads in it (a `?lang=` in the address would win, so it is dropped). */
export function switchLang(): void {
  try {
    localStorage.setItem(LANG_KEY, LANG === 'es' ? 'en' : 'es')
  } catch {
    // Private mode: the choice rides on the address instead.
    const url = new URL(window.location.href)
    url.searchParams.set('lang', LANG === 'es' ? 'en' : 'es')
    window.location.href = url.toString()
    return
  }
  const url = new URL(window.location.href)
  url.searchParams.delete('lang')
  window.location.href = url.toString()
}
