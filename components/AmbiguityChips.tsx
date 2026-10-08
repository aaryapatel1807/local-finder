'use client'
import GlassCard from './shared/GlassCard'

export interface AmbiguityOption {
  label: string
  query: string
}

interface AmbiguityChipsProps {
  term: string
  options: AmbiguityOption[]
  onSelect: (query: string) => void
  onDismiss: () => void
}

/**
 * Disambiguation UX for AI-parsed queries: "Did you mean…" + one-tap chips,
 * plus a subtle "Search as typed" escape hatch. Shown instead of results —
 * nothing is searched until the user picks an option.
 */
export default function AmbiguityChips({ term, options, onSelect, onDismiss }: AmbiguityChipsProps) {
  return (
    <div role="group" aria-label={`Did you mean one of these for "${term}"`}>
    <GlassCard padding="p-4">
      <div style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '10px' }}>
        Did you mean…
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {options.map(o => (
          <button
            key={o.query}
            type="button"
            onClick={() => onSelect(o.query)}
            className="chip chip-purple"
            style={{ cursor: 'pointer', fontFamily: "'Satoshi', sans-serif", padding: '9px 16px', fontSize: '0.85rem' }}
          >
            {o.label}
          </button>
        ))}
      </div>
      <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={onDismiss}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: '4px 2px',
            color: 'var(--text-muted)', fontSize: '0.8rem', textDecoration: 'underline',
            fontFamily: "'Satoshi', sans-serif",
          }}
        >
          Search as typed
        </button>
      </div>
    </GlassCard>
    </div>
  )
}
