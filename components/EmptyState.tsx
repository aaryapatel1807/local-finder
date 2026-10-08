'use client'
import { SearchX } from 'lucide-react'
import GlassCard from './shared/GlassCard'
import Button from './ui/button'
import { useLanguage } from '../hooks/useLanguage'

/** Empty results state (spec 2.1 + 7.8). */
export default function EmptyState({ onWidenRadius }: { onWidenRadius?: () => void }) {
  const { t } = useLanguage()
  return (
    <GlassCard className="flex flex-col items-center text-center py-10 px-6">
      <div
        style={{
          width: 56, height: 56, borderRadius: '50%',
          background: 'var(--track)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-muted)', marginBottom: 12,
        }}
      >
        <SearchX size={26} />
      </div>
      <h3 style={{ fontSize: '1.05rem', marginBottom: 6 }}>{t('empty.title')}</h3>
      <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', maxWidth: 320, marginBottom: onWidenRadius ? 14 : 0 }}>
        {t('empty.body')}
      </p>
      {onWidenRadius && (
        <Button variant="primary" onClick={onWidenRadius}>
          {t('empty.widen')}
        </Button>
      )}
    </GlassCard>
  )
}
