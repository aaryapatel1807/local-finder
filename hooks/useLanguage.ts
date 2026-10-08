'use client'
import { useCallback, useState } from 'react'
import { translate, type Lang } from '../lib/i18n/dictionary'

const STORAGE_KEY = 'localfinder_lang'
const DEFAULT_LANG: Lang = 'en'

function isLang(v: unknown): v is Lang {
  return v === 'en' || v === 'hi' || v === 'gu'
}

/** Read the persisted language once (lazy init so SSR renders English). */
function readStoredLang(): Lang {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (isLang(raw)) return raw
  } catch {
    // localStorage unavailable (SSR / private mode) — fall through.
  }
  return DEFAULT_LANG
}

/** Interpolates `{var}` placeholders and falls back to English (see lib/i18n/dictionary). */

/**
 * App language state. Returns the active `lang`, a `setLang` that persists
 * the choice, and `t(key, vars)` for translated strings with English fallback.
 */
export function useLanguage() {
  const [lang, setLangState] = useState<Lang>(readStoredLang)

  const setLang = useCallback((next: Lang) => {
    setLangState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Persistence is best-effort.
    }
  }, [])

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>): string =>
      translate(lang, key, vars),
    [lang],
  )

  return { lang, setLang, t }
}
