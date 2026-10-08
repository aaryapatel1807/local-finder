'use client'
import { AlertTriangle, CloudOff } from 'lucide-react'
import GlassCard from './shared/GlassCard'
import Button from './ui/button'

interface ErrorStateProps {
  /** Machine code from the API (QUOTA_EXCEEDED, RATE_LIMITED, …) */
  code?: string
  message?: string
  onRetry?: () => void
}

/** Error + quota-exceeded states (spec 7.8). */
export default function ErrorState({ code, message, onRetry }: ErrorStateProps) {
  const isQuota = code === 'QUOTA_EXCEEDED'
  const title = isQuota
    ? 'Search is busy right now'
    : code === 'RATE_LIMITED'
      ? 'Too many searches'
      : 'Something went wrong'

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
          ? 'We\'ve used up our live place searches for now. Please wait a bit and try again.'
          : (message || 'Couldn\'t reach the places service. Check your connection and try again.')}
      </p>
      {onRetry && (
        <Button variant="ghost" onClick={onRetry}>
          Try again
        </Button>
      )}
    </GlassCard>
  )
}
