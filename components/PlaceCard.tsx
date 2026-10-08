'use client'
import { useMemo, useState } from 'react'
import { Check, Heart, Star } from 'lucide-react'
import type { Place } from './types'
import { formatDistance } from './types'
import Badge from './ui/badge'
import GlassCard from './shared/GlassCard'
import RouteBadge from './RouteBadge'
import { useRouteTime } from '../hooks/useRouteTime'

export function StatusBadge({ place }: { place: Place }) {
  if (place.closesSoon) {
    return <Badge color="#D97706" background="rgba(217,119,6,0.12)" border="rgba(217,119,6,0.25)">Closing soon</Badge>
  }
  if (place.isOpen === true) {
    return <Badge color="#16A34A" background="rgba(22,163,74,0.12)" border="rgba(22,163,74,0.25)">Open</Badge>
  }
  if (place.isOpen === false) {
    return <Badge color="#DC2626" background="rgba(220,38,38,0.10)" border="rgba(220,38,38,0.25)">Closed</Badge>
  }
  return <Badge color="var(--text-muted)" background="var(--track)" border="var(--border)">Hours unknown</Badge>
}

export function Stars({ rating }: { rating?: number }) {
  if (rating === undefined || rating === null) {
    return <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No rating</span>
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }} aria-label={`Rated ${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          size={13}
          aria-hidden
          fill={i <= Math.round(rating) ? '#FFB020' : 'transparent'}
          stroke={i <= Math.round(rating) ? '#FFB020' : 'var(--text-muted)'}
          strokeWidth={1.5}
        />
      ))}
    </span>
  )
}

interface PlaceCardProps {
  place: Place
  isFavorite: boolean
  onToggleFavorite: (place: Place) => void
  onOpen: (place: Place) => void
  highlighted?: boolean
  /** Optional user location — enables the "N min walk" route badge. */
  userCoords?: { lat: number; lng: number } | null
  /** Compare mode: show a select checkbox (max 2 selected). */
  selectable?: boolean
  compareSelected?: boolean
  compareDisabled?: boolean
  onToggleCompare?: (place: Place) => void
}

/** Glass result card — the same component renders the Saved tab. */
export default function PlaceCard({
  place, isFavorite, onToggleFavorite, onOpen, highlighted,
  userCoords, selectable, compareSelected, compareDisabled, onToggleCompare,
}: PlaceCardProps) {
  const [imgFailed, setImgFailed] = useState(false)
  const places = useMemo(() => [place], [place])
  const routes = useRouteTime(userCoords, places, 'walk')
  const route = routes.get(place.id)

  return (
    <GlassCard
      hover
      padding="p-4"
      onClick={() => onOpen(place)}
      style={{
        display: 'flex',
        gap: '12px',
        alignItems: 'flex-start',
        cursor: 'pointer',
        outline: highlighted ? '2px solid var(--accent)' : undefined,
      }}
    >
      <div style={{ flexShrink: 0 }}>
        {place.thumbnail && !imgFailed ? (
          <img
            src={place.thumbnail}
            alt=""
            loading="lazy"
            width={72}
            height={72}
            onError={() => setImgFailed(true)}
            style={{ width: 72, height: 72, borderRadius: 16, objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <div
            aria-hidden
            style={{
              width: 72, height: 72, borderRadius: 16,
              background: 'linear-gradient(135deg, rgba(21,178,207,0.25), rgba(123,97,255,0.25))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-muted)', fontSize: '1.4rem', fontWeight: 700,
            }}
          >
            {place.name.charAt(0)}
          </div>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
          <h3 style={{ fontSize: '0.98rem', fontWeight: 600, lineHeight: 1.3 }}>{place.name}</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
            {selectable && (
              <button
                type="button"
                role="checkbox"
                aria-checked={!!compareSelected}
                aria-label={compareSelected ? `Remove ${place.name} from comparison` : `Select ${place.name} for comparison`}
                disabled={!compareSelected && compareDisabled}
                onClick={e => { e.stopPropagation(); onToggleCompare?.(place) }}
                title={!compareSelected && compareDisabled ? 'Pick up to two places' : undefined}
                style={{
                  background: compareSelected ? 'var(--accent)' : 'var(--track)',
                  border: `1px solid ${compareSelected ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: '8px', width: 26, height: 26,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: compareSelected ? '#fff' : 'var(--text-muted)',
                  cursor: !compareSelected && compareDisabled ? 'not-allowed' : 'pointer',
                  opacity: !compareSelected && compareDisabled ? 0.4 : 1,
                }}
              >
                {compareSelected && <Check size={15} />}
              </button>
            )}
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onToggleFavorite(place) }}
              aria-label={isFavorite ? `Remove ${place.name} from saved` : `Save ${place.name}`}
              aria-pressed={isFavorite}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer', padding: 4,
                color: isFavorite ? '#E14E42' : 'var(--text-muted)', flexShrink: 0,
                borderRadius: '8px',
              }}
            >
              <Heart size={18} fill={isFavorite ? '#E14E42' : 'transparent'} />
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
          <Stars rating={place.rating} />
          {place.rating !== undefined && place.rating !== null && (
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>{place.rating.toFixed(1)}</span>
          )}
          {place.reviews !== undefined && place.reviews !== null && (
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>({place.reviews.toLocaleString()})</span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
          <StatusBadge place={place} />
          {place.distanceKm !== undefined && (
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{formatDistance(place.distanceKm)}</span>
          )}
          <RouteBadge route={route} mode="walk" />
          {place.price && (
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>{place.price}</span>
          )}
        </div>

        {place.openLabel && (
          <div style={{ fontSize: '0.78rem', color: 'var(--text-faint)', marginTop: '4px' }}>{place.openLabel}</div>
        )}
      </div>
    </GlassCard>
  )
}
