'use client'
import { useLanguage } from '../hooks/useLanguage'

export const CATEGORIES: { key: string; query: string }[] = [
  { key: 'chips.pharmacy', query: 'pharmacy' },
  { key: 'chips.chai', query: 'chai' },
  { key: 'chips.atm', query: 'ATM' },
  { key: 'chips.petrol', query: 'petrol pump' },
  { key: 'chips.clinic', query: 'clinic' },
  { key: 'chips.stationery', query: 'stationery shop' },
  { key: 'chips.mechanic', query: 'car mechanic' },
  { key: 'chips.groceries', query: 'grocery store' },
]

/** Horizontally scrollable one-tap category row — tapping sets the query and searches. */
export default function CategoryChips({ onSelect, activeQuery }: { onSelect: (query: string) => void; activeQuery?: string }) {
  const { t } = useLanguage()
  return (
    <div
      role="list"
      aria-label={t('chips.aria')}
      style={{
        display: 'flex',
        gap: '8px',
        overflowX: 'auto',
        paddingBottom: '4px',
        scrollbarWidth: 'none',
      }}
    >
      {CATEGORIES.map(cat => {
        const label = t(cat.key)
        const active = activeQuery?.toLowerCase() === cat.query.toLowerCase()
        return (
          <button
            key={cat.key}
            role="listitem"
            type="button"
            onClick={() => onSelect(cat.query)}
            aria-pressed={active}
            className={(active ? 'chip chip-green' : 'chip chip-muted') + ' active:scale-95 transition-transform duration-150'}
            style={{
              cursor: 'pointer',
              fontFamily: "'Satoshi', sans-serif",
              whiteSpace: 'nowrap',
              padding: '8px 16px',
              fontSize: '0.85rem',
            }}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
