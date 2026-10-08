'use client'
import GlassCard from './shared/GlassCard'
import { useLanguage } from '../hooks/useLanguage'

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
  const { t } = useLanguage()
  return (
    <div role="group" aria-label={t('clarifier.groupAria', { term })}>
    <GlassCard padding="p-4">
      <div style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '10px' }}>
        {t('clarifier.title')}
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
          {t('clarifier.searchAsTyped')}
        </button>
      </div>
    </GlassCard>
    </div>
  )
}
