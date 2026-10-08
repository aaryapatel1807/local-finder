'use client'
import { X } from 'lucide-react'
import type { Place } from './types'
import { formatDistance } from './types'
import { StatusBadge, Stars } from './PlaceCard'
import GlassCard from './shared/GlassCard'
import Button from './ui/button'
import { useRouteTime } from '../hooks/useRouteTime'
import { useLanguage } from '../hooks/useLanguage'

interface CompareTableProps {
  /** Two or three places to compare side by side. */
  places: Place[]
  userCoords?: { lat: number; lng: number } | null
  onClose: () => void
  onClear: () => void
}

function RowLabel({ children }: { children: React.ReactNode }) {
  return (
    <th
      scope="row"
      style={{
        textAlign: 'left', fontSize: '0.78rem', fontWeight: 600,
        color: 'var(--text-muted)', padding: '10px 8px', verticalAlign: 'top',
      }}
    >
      {children}
    </th>
  )
}

function Cell({ children }: { children: React.ReactNode }) {
  return (
    <td style={{ padding: '10px 8px', fontSize: '0.85rem', color: 'var(--text-primary)', verticalAlign: 'top' }}>
      {children}
    </td>
  )
}

/** Side-by-side comparison of two or three places in a GlassCard panel. */
export default function CompareTable({ places, userCoords, onClose, onClear }: CompareTableProps) {
  const { t } = useLanguage()
  const routes = useRouteTime(userCoords, places, 'walk')
  const walkTime = (p: Place) => {
    const r = routes.get(p.id)
    if (!r || !Number.isFinite(r.durationMin)) return '—'
    const mins = Math.max(1, Math.round(r.durationMin))
    return `${r.estimated ? '~' : ''}${mins} min`
  }

  return (
    <div role="region" aria-label={t('compare.comparing', { names: places.map(p => p.name).join(', ') })}>
    <GlassCard padding="p-4" style={{ position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 700 }}>
          {t('compare.title')} <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>({places.length})</span>
        </h3>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('compare.close')}
          style={{
            background: 'var(--track)', border: 'none', borderRadius: '50%',
            width: 30, height: 30, display: 'flex', alignItems: 'center',
            justifyContent: 'center', color: 'var(--text-muted)', cursor: 'pointer',
          }}
        >
          <X size={15} />
        </button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 320 }}>
          <thead>
            <tr>
              <th style={{ width: '24%' }}><span className="sr-only">Attribute</span></th>
              {places.map(p => (
                <th key={p.id} scope="col" style={{ textAlign: 'left', padding: '10px 8px', fontSize: '0.9rem', fontWeight: 700 }}>
                  {p.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <RowLabel>{t('compare.rating')}</RowLabel>
              {places.map(p => (
                <Cell key={p.id}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <Stars rating={p.rating} />
                    {p.rating !== undefined && p.rating !== null ? p.rating.toFixed(1) : ''}
                  </span>
                </Cell>
              ))}
            </tr>
            <tr>
              <RowLabel>{t('compare.reviews')}</RowLabel>
              {places.map(p => (
                <Cell key={p.id}>{p.reviews !== undefined && p.reviews !== null ? p.reviews.toLocaleString() : '—'}</Cell>
              ))}
            </tr>
            <tr>
              <RowLabel>{t('compare.distance')}</RowLabel>
              {places.map(p => (
                <Cell key={p.id}>{p.distanceKm !== undefined ? formatDistance(p.distanceKm) : '—'}</Cell>
              ))}
            </tr>
            <tr>
              <RowLabel>{t('compare.walkTime')}</RowLabel>
              {places.map(p => <Cell key={p.id}>{walkTime(p)}</Cell>)}
            </tr>
            <tr>
              <RowLabel>{t('compare.price')}</RowLabel>
              {places.map(p => <Cell key={p.id}>{p.price ?? '—'}</Cell>)}
            </tr>
            <tr>
              <RowLabel>{t('compare.hoursToday')}</RowLabel>
              {places.map(p => <Cell key={p.id}>{p.hoursToday ?? '—'}</Cell>)}
            </tr>
            <tr>
              <RowLabel>{t('compare.status')}</RowLabel>
              {places.map(p => <Cell key={p.id}><StatusBadge place={p} /></Cell>)}
            </tr>
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
        <Button variant="ghost" onClick={onClear} style={{ fontSize: '0.82rem' }}>
          Clear selection
        </Button>
      </div>
    </GlassCard>
    </div>
  )
}
