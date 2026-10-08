'use client'
import { X } from 'lucide-react'
import type { Place } from './types'
import { formatDistance } from './types'
import { StatusBadge, Stars } from './PlaceCard'
import GlassCard from './shared/GlassCard'
import Button from './ui/button'
import { useRouteTime } from '../hooks/useRouteTime'

interface CompareTableProps {
  /** Exactly two places to compare side by side. */
  places: [Place, Place]
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

/** Side-by-side comparison of two places in a GlassCard panel. */
export default function CompareTable({ places, userCoords, onClose, onClear }: CompareTableProps) {
  const [a, b] = places
  const routes = useRouteTime(userCoords, places, 'walk')
  const walkTime = (p: Place) => {
    const r = routes.get(p.id)
    return r && Number.isFinite(r.durationMin) ? `~${Math.max(1, Math.round(r.durationMin))} min` : '—'
  }

  return (
    <div role="region" aria-label={`Comparing ${a.name} and ${b.name}`}>
    <GlassCard padding="p-4" style={{ position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 700 }}>Compare</h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close comparison"
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
              <th style={{ width: '28%' }}><span className="sr-only">Attribute</span></th>
              <th scope="col" style={{ textAlign: 'left', padding: '10px 8px', fontSize: '0.9rem', fontWeight: 700 }}>{a.name}</th>
              <th scope="col" style={{ textAlign: 'left', padding: '10px 8px', fontSize: '0.9rem', fontWeight: 700 }}>{b.name}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <RowLabel>Rating</RowLabel>
              <Cell><span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Stars rating={a.rating} />{a.rating !== undefined && a.rating !== null ? a.rating.toFixed(1) : ''}</span></Cell>
              <Cell><span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Stars rating={b.rating} />{b.rating !== undefined && b.rating !== null ? b.rating.toFixed(1) : ''}</span></Cell>
            </tr>
            <tr>
              <RowLabel>Reviews</RowLabel>
              <Cell>{a.reviews !== undefined && a.reviews !== null ? a.reviews.toLocaleString() : '—'}</Cell>
              <Cell>{b.reviews !== undefined && b.reviews !== null ? b.reviews.toLocaleString() : '—'}</Cell>
            </tr>
            <tr>
              <RowLabel>Distance</RowLabel>
              <Cell>{a.distanceKm !== undefined ? formatDistance(a.distanceKm) : '—'}</Cell>
              <Cell>{b.distanceKm !== undefined ? formatDistance(b.distanceKm) : '—'}</Cell>
            </tr>
            <tr>
              <RowLabel>Walk time</RowLabel>
              <Cell>{walkTime(a)}</Cell>
              <Cell>{walkTime(b)}</Cell>
            </tr>
            <tr>
              <RowLabel>Price</RowLabel>
              <Cell>{a.price ?? '—'}</Cell>
              <Cell>{b.price ?? '—'}</Cell>
            </tr>
            <tr>
              <RowLabel>Hours today</RowLabel>
              <Cell>{a.hoursToday ?? '—'}</Cell>
              <Cell>{b.hoursToday ?? '—'}</Cell>
            </tr>
            <tr>
              <RowLabel>Status</RowLabel>
              <Cell><StatusBadge place={a} /></Cell>
              <Cell><StatusBadge place={b} /></Cell>
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
