import { describe, expect, it } from 'vitest'
import { LANGS, STRINGS, translate, type Lang } from './dictionary'

const LANG_CODES: Lang[] = ['en', 'hi', 'gu']

describe('i18n dictionary', () => {
  it('defines the three supported languages', () => {
    expect(LANG_CODES).toEqual(['en', 'hi', 'gu'])
    expect(LANGS.map(l => l.code)).toEqual(LANG_CODES)
    expect(Object.keys(STRINGS).sort()).toEqual(['en', 'gu', 'hi'])
  })

  it('has every key present in all three languages', () => {
    const keys = Object.keys(STRINGS.en)
    expect(keys.length).toBeGreaterThan(0)
    for (const lang of LANG_CODES) {
      for (const key of keys) {
        expect(STRINGS[lang][key], `${lang} missing key "${key}"`).toBeDefined()
      }
    }
    // no extras either — all tables carry exactly the same key set
    for (const lang of LANG_CODES) {
      expect(Object.keys(STRINGS[lang]).sort()).toEqual(keys.sort())
    }
  })

  it('has no empty or whitespace-only strings', () => {
    for (const lang of LANG_CODES) {
      for (const [key, value] of Object.entries(STRINGS[lang])) {
        expect(value.trim().length, `${lang}.${key} is empty`).toBeGreaterThan(0)
      }
    }
  })

  it('interpolates {var} placeholders', () => {
    expect(translate('en', 'page.resultsMany', { count: 5 })).toBe('5 places found')
    expect(translate('hi', 'page.resultsMany', { count: 5 })).toBe('5 जगहें मिलीं')
    expect(translate('gu', 'page.resultsMany', { count: 5 })).toBe('5 સ્થળો મળ્યા')
    expect(translate('en', 'filters.radiusUnit', { n: 3 })).toBe('3 km')
    expect(translate('en', 'sheet.details', { name: 'Cafe Mocha' })).toBe('Cafe Mocha details')
    // unknown vars are left as-is rather than blanked out
    expect(translate('en', 'sheet.details')).toBe('{name} details')
  })

  it('falls back to English for keys missing in the active language', () => {
    const hi = STRINGS.hi as Record<string, string>
    const saved = hi['empty.title']
    delete hi['empty.title']
    try {
      expect(translate('hi', 'empty.title')).toBe(STRINGS.en['empty.title'])
    } finally {
      hi['empty.title'] = saved
    }
  })

  it('returns the key itself for completely unknown keys', () => {
    expect(translate('gu', 'no.such.key')).toBe('no.such.key')
  })

  it('translate() defaults to the requested language, not English', () => {
    expect(translate('hi', 'empty.title')).toBe(STRINGS.hi['empty.title'])
    expect(translate('gu', 'empty.title')).toBe(STRINGS.gu['empty.title'])
    expect(translate('hi', 'empty.title')).not.toBe(STRINGS.en['empty.title'])
  })
})
