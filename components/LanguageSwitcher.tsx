'use client'
import { LANGS, type Lang } from '../lib/i18n/dictionary'
import Select from './ui/select'

interface LanguageSwitcherProps {
  value: Lang
  onChange: (lang: Lang) => void
}

/** Compact language select (EN / हिं / ગુ) on the glass select style. */
export default function LanguageSwitcher({ value, onChange }: LanguageSwitcherProps) {
  return (
    <Select
      value={value}
      onChange={e => onChange(e.target.value as Lang)}
      aria-label="Language"
      title="Language"
      style={{ padding: '8px 10px', fontSize: '0.8rem' }}
    >
      {LANGS.map(l => (
        <option key={l.code} value={l.code}>
          {l.label}
        </option>
      ))}
    </Select>
  )
}
