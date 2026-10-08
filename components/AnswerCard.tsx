'use client'
import { Sparkles, X } from 'lucide-react'
import GlassCard from './shared/GlassCard'
import Button from './ui/button'
import { useLanguage } from '../hooks/useLanguage'

interface AnswerCardProps {
  placeName: string
  reasons: string[]
  summary?: string | null
  loading?: boolean
  onOpenDetails?: () => void
  onDismiss?: () => void
}

/**
 * AI answer card for question-like queries (POST /api/answer): the top pick
 * with reasons + summary, rendered above the normal result list.
 */
export default function AnswerCard({
  placeName, reasons, summary, loading, onOpenDetails, onDismiss,
}: AnswerCardProps) {
  const { t } = useLanguage()
  return (
    <GlassCard
      padding="p-4"
      aria-live="polite"
      style={{ border: '1px solid var(--accent-purple)', position: 'relative' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <Sparkles size={16} style={{ color: 'var(--accent-purple)' }} aria-hidden />
        <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{t('answer.topPick')}</span>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label={t('answer.dismiss')}
            style={{
              marginLeft: 'auto', background: 'var(--track)', border: 'none',
              borderRadius: '50%', width: 28, height: 28,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-muted)', cursor: 'pointer',
            }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{t('answer.loading')}</div>
      ) : (
        <>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '8px' }}>{placeName}</h3>
          {reasons.length > 0 && (
            <ul style={{ margin: '0 0 10px', paddingLeft: '20px', fontSize: '0.88rem', color: 'var(--text-faint)', lineHeight: 1.6 }}>
              {reasons.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          )}
          {summary && (
            <p style={{ fontSize: '0.88rem', color: 'var(--text-faint)', lineHeight: 1.6, marginBottom: '12px' }}>
              {summary}
            </p>
          )}
          {onOpenDetails && (
            <Button variant="primary" onClick={onOpenDetails} style={{ padding: '10px 18px' }}>
              {t('answer.viewDetails')}
            </Button>
          )}
        </>
      )}
    </GlassCard>
  )
}

/** Props for the quota-exhausted general answer (flagged unverified). */
interface UnverifiedAnswerCardProps {
  text: string
  loading?: boolean
  onDismiss?: () => void
}

/**
 * Quota-exhausted AI mode card: general-knowledge guidance rendered in a
 * DISTINCT amber card, explicitly labeled as not-verified listings — never
 * confused with real search results.
 */
export function UnverifiedAnswerCard({ text, loading, onDismiss }: UnverifiedAnswerCardProps) {
  const { t } = useLanguage()
  return (
    <GlassCard
      padding="p-4"
      aria-live="polite"
      style={{ border: '1px solid rgba(217,119,6,0.45)', position: 'relative' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <Sparkles size={16} style={{ color: '#D97706' }} aria-hidden />
        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#B45309' }}>
          {t('answer.unverifiedTitle')}
        </span>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label={t('answer.dismiss')}
            style={{
              marginLeft: 'auto', background: 'var(--track)', border: 'none',
              borderRadius: '50%', width: 28, height: 28,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-muted)', cursor: 'pointer',
            }}
          >
            <X size={14} />
          </button>
        )}
      </div>
      {loading ? (
        <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{t('answer.loading')}</div>
      ) : (
        <>
          <p style={{ fontSize: '0.9rem', lineHeight: 1.65, color: 'var(--text-primary)', marginBottom: '10px', whiteSpace: 'pre-line' }}>
            {text}
          </p>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-faint)', lineHeight: 1.5, margin: 0 }}>
            {t('answer.unverifiedNote')}
          </p>
        </>
      )}
    </GlassCard>
  )
}
