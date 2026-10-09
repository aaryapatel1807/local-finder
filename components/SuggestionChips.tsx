'use client'

import { useState } from 'react'
import { useLanguage } from '../hooks/useLanguage'
import {
  slotForHour,
  type SuggestionSlot,
} from '../lib/suggestions'

// Re-exported for tests and for the wiring agent.
export { slotForHour }
export type { SuggestionSlot, SuggestionChipDef } from '../lib/suggestions'

export interface SuggestionChipsProps {
  /** Fires the chip's search query. */
  onSelect: (query: string) => void
}

const FONT = "'Satoshi', sans-serif"

/**
 * Time-aware suggestion chips for the empty home state.
 * Labels are localized; queries stay English.
 */
export default function SuggestionChips({ onSelect }: { onSelect: (query: string) => void }) {
  const { t } = useLanguage()
  const [slot] = useState<SuggestionSlot>(() => slotForHour(new Date().getHours()))
  const HeadingIcon = slot.HeadingIcon

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p
        style={{
          margin: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: '0.88rem',
          fontWeight: 600,
          color: 'var(--text-primary)',
          fontFamily: FONT,
        }}
      >
        <HeadingIcon size={16} style={{ color: 'var(--accent)' }} aria-hidden />
        {t(slot.headingKey)}
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {slot.chips.map(({ labelKey, query, Icon }) => (
          <button
            key={query}
            type="button"
            onClick={() => onSelect(query)}
            aria-label={query}
            className="transition-transform duration-150 ease-out active:scale-95"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '9px 14px',
              borderRadius: 999,
              border: '1px solid var(--glass-border)',
              background: 'var(--glass-bg)',
              backdropFilter: 'blur(26px) saturate(1.6)',
              WebkitBackdropFilter: 'blur(26px) saturate(1.6)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              fontWeight: 500,
              fontFamily: FONT,
              cursor: 'pointer',
              boxShadow: 'var(--glass-shadow)',
            }}
          >
            <Icon size={15} style={{ color: 'var(--accent-deep)' }} aria-hidden />
            {t(labelKey)}
          </button>
        ))}
      </div>
    </div>
  )
}
