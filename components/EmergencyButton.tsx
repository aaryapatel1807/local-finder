'use client'

import { Siren } from 'lucide-react'
import { useLanguage } from '../hooks/useLanguage'

export interface EmergencyButtonProps {
  /** Fires the combined emergency search (hospitals, pharmacies, help). */
  onActivate: () => void
}

/**
 * Single big red emergency button. Thumb-reachable, full width.
 * Solid red (functional color), Satoshi type, press feedback.
 */
export default function EmergencyButton({ onActivate }: { onActivate: () => void }) {
  const { t } = useLanguage()

  return (
    <button
      type="button"
      onClick={onActivate}
      aria-label={t('emergency.aria')}
      className="transition-transform duration-150 ease-out active:scale-95"
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '16px 18px',
        border: 'none',
        borderRadius: 18,
        background: '#dc2626',
        color: '#fff',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: "'Satoshi', sans-serif",
      }}
    >
      <span
        aria-hidden
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 48,
          height: 48,
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.2)',
          flexShrink: 0,
        }}
      >
        <Siren size={26} />
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: '1.02rem', fontWeight: 700, lineHeight: 1.3 }}>
          {t('emergency.title')}
        </span>
        <span style={{ fontSize: '0.82rem', opacity: 0.92, lineHeight: 1.4 }}>
          {t('emergency.body')}
        </span>
      </span>
    </button>
  )
}
