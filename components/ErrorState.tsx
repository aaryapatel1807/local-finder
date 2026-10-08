'use client'
import { AlertTriangle, CloudOff } from 'lucide-react'
import GlassCard from './shared/GlassCard'
import Button from './ui/button'
import { useLanguage } from '../hooks/useLanguage'

interface ErrorStateProps {
  /** Machine code from the API (QUOTA_EXCEEDED, RATE_LIMITED, …) */
  code?: string
  message?: string
  onRetry?: () => void
  /** Quota-exhausted AI mode: offered only for QUOTA_EXCEEDED. */
  onAskAi?: () => void
  aiLoading?: boolean
}

/** Error + quota-exceeded states (spec 7.8). */
export default function ErrorState({ code, message, onRetry, onAskAi, aiLoading }: ErrorStateProps) {
  const { t } = useLanguage()
  const isQuota = code === 'QUOTA_EXCEEDED'
  const title = isQuota
    ? t('error.quotaTitle')
    : code === 'RATE_LIMITED'
      ? t('error.rateTitle')
      : t('error.genericTitle')

  return (
    <GlassCard className="flex flex-col items-center text-center py-10 px-6">
      <div
        style={{
          width: 56, height: 56, borderRadius: '50%',
          background: isQuota ? 'rgba(217,119,6,0.12)' : 'rgba(220,38,38,0.10)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: isQuota ? '#D97706' : '#DC2626', marginBottom: 12,
        }}
      >
        {isQuota ? <CloudOff size={26} /> : <AlertTriangle size={26} />}
      </div>
      <h3 style={{ fontSize: '1.05rem', marginBottom: 6 }}>{title}</h3>
      <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', maxWidth: 340, marginBottom: onRetry ? 14 : 0 }}>
        {isQuota
          ? t('error.quotaBody')
          : (message || t('error.genericBody'))}
      </p>
      {onRetry && (
        <Button variant="ghost" onClick={onRetry}>
          {t('error.retry')}
        </Button>
      )}
      {isQuota && onAskAi && (
        <div style={{ marginTop: onRetry ? 8 : 14 }}>
          <Button variant="primary" onClick={onAskAi} disabled={aiLoading}>
            {aiLoading ? t('answer.loading') : t('error.askAi')}
          </Button>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-faint)', marginTop: 8, maxWidth: 320 }}>
            {t('error.askAiNote')}
          </p>
        </div>
      )}
    </GlassCard>
  )
}
