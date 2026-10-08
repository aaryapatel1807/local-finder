'use client'

export const CATEGORIES = [
  { label: 'Pharmacy', query: 'pharmacy' },
  { label: 'Chai', query: 'chai' },
  { label: 'ATM', query: 'ATM' },
  { label: 'Petrol pump', query: 'petrol pump' },
  { label: 'Clinic', query: 'clinic' },
  { label: 'Stationery', query: 'stationery shop' },
  { label: 'Mechanic', query: 'car mechanic' },
  { label: 'Groceries', query: 'grocery store' },
]

/** Horizontally scrollable one-tap category row — tapping sets the query and searches. */
export default function CategoryChips({ onSelect, activeQuery }: { onSelect: (query: string) => void; activeQuery?: string }) {
  return (
    <div
      role="list"
      aria-label="Quick categories"
      style={{
        display: 'flex',
        gap: '8px',
        overflowX: 'auto',
        paddingBottom: '4px',
        scrollbarWidth: 'none',
      }}
    >
      {CATEGORIES.map(cat => {
        const active = activeQuery?.toLowerCase() === cat.query.toLowerCase()
        return (
          <button
            key={cat.label}
            role="listitem"
            type="button"
            onClick={() => onSelect(cat.query)}
            aria-pressed={active}
            className={active ? 'chip chip-green' : 'chip chip-muted'}
            style={{
              cursor: 'pointer',
              fontFamily: "'Satoshi', sans-serif",
              whiteSpace: 'nowrap',
              padding: '8px 16px',
              fontSize: '0.85rem',
            }}
          >
            {cat.label}
          </button>
        )
      })}
    </div>
  )
}
