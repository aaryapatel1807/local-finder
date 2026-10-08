'use client'
import { useMemo, useState } from 'react'
import { Check, Heart, MessageCircle, Phone, Sparkles, Star } from 'lucide-react'
import type { Place } from './types'
import { formatDistance } from './types'
import Badge from './ui/badge'
import GlassCard from './shared/GlassCard'
import RouteBadge from './RouteBadge'
import { useRouteTime } from '../hooks/useRouteTime'
import { useLanguage } from '../hooks/useLanguage'

/** Place with the Phase 2 server field minutesToClose (defensive: may be absent). */
type PlaceWithClose = Place & { minutesToClose?: number }

export function openStatusText(place: Place): string {
  if (place.isOpen === true) return 'Open'
  if (place.isOpen === false) return 'Closed'
  return 'Hours unknown'
}

/** wa.me share link: "<name> — <open status>. <address>. <maps link>". */
export function whatsappShareUrl(place: Place): string {
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`
  const parts = [`${place.name} — ${openStatusText(place)}`, place.address, mapsUrl].filter(Boolean)
  return `https://wa.me/?text=${encodeURIComponent(parts.join('. '))}`
}

export function StatusBadge({ place }: { place: Place }) {
  const { t } = useLanguage()
  const minutesToClose = (place as PlaceWithClose).minutesToClose
  if (
    place.isOpen === true &&
    typeof minutesToClose === 'number' &&
    Number.isFinite(minutesToClose) &&
    minutesToClose >= 0
  ) {
    return (
      <Badge color="#B45309" background="rgba(217,119,6,0.14)" border="rgba(217,119,6,0.30)">
        {t('badges.closesIn', { n: Math.round(minutesToClose) })}
      </Badge>
    )
  }
  if (place.closesSoon) {
    return <Badge color="#D97706" background="rgba(217,119,6,0.12)" border="rgba(217,119,6,0.25)">{t('badges.closesSoon')}</Badge>
  }
  if (place.isOpen === true) {
    return <Badge color="#16A34A" background="rgba(22,163,74,0.12)" border="rgba(22,163,74,0.25)">{t('badges.open')}</Badge>
  }
  if (place.isOpen === false) {
    return <Badge color="#DC2626" background="rgba(220,38,38,0.10)" border="rgba(220,38,38,0.25)">{t('badges.closed')}</Badge>
  }
  return <Badge color="var(--text-muted)" background="var(--track)" border="var(--border)">{t('badges.unknown')}</Badge>
}

export function Stars({ rating }: { rating?: number }) {
  const { t } = useLanguage()
  if (rating === undefined || rating === null) {
    return <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t('badges.noRating')}</span>
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }} aria-label={t('badges.rated', { rating })}>
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
  /** Compare mode: show a select checkbox (max 3 selected). */
  selectable?: boolean
  compareSelected?: boolean
  compareDisabled?: boolean
  onToggleCompare?: (place: Place) => void
  /** Emergency mode: show a large one-tap call button. */
  emergency?: boolean
  /** Top-quartile Bayesian rating with <100 reviews — "Hidden gem". */
  hiddenGem?: boolean
}

/** Glass result card — the same component renders the Saved tab. */
export default function PlaceCard({
  place, isFavorite, onToggleFavorite, onOpen, highlighted,
  userCoords, selectable, compareSelected, compareDisabled, onToggleCompare,
  emergency, hiddenGem,
}: PlaceCardProps) {
  const { t } = useLanguage()
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
            {emergency && place.phone && (
              <a
                href={`tel:${place.phone}`}
                onClick={e => e.stopPropagation()}
                aria-label={t('card.callNow', { name: place.name })}
                title={t('sheet.callAria', { name: place.name })}
                style={{
                  background: 'rgba(22,163,74,0.16)',
                  border: '1px solid rgba(22,163,74,0.4)',
                  borderRadius: '14px', width: 44, height: 44,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#16A34A', flexShrink: 0,
                }}
              >
                <Phone size={21} />
              </a>
            )}
            <a
              href={whatsappShareUrl(place)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              aria-label={t('card.shareWhatsApp', { name: place.name })}
              title={t('card.shareWhatsAppTitle')}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer', padding: 4,
                color: 'var(--text-muted)', flexShrink: 0, borderRadius: '8px',
                display: 'flex', alignItems: 'center',
              }}
            >
              <MessageCircle size={18} />
            </a>
            {selectable && (
              <button
                type="button"
                role="checkbox"
                aria-checked={!!compareSelected}
                aria-label={t(compareSelected ? 'card.compareRemove' : 'card.compareSelect', { name: place.name })}
                disabled={!compareSelected && compareDisabled}
                onClick={e => { e.stopPropagation(); onToggleCompare?.(place) }}
                title={!compareSelected && compareDisabled ? t('card.compareMax') : undefined}
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
              aria-label={t(isFavorite ? 'card.unsave' : 'card.save', { name: place.name })}
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
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>({t('card.reviews', { count: place.reviews.toLocaleString() })})</span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
          <StatusBadge place={place} />
          {place.source === 'osm' && (
            <Badge color="var(--text-muted)" background="var(--track)" border="var(--border)">
              {t('badges.communityData')}
            </Badge>
          )}
          {hiddenGem && (
            <Badge color="#7B61FF" background="rgba(123,97,255,0.12)" border="rgba(123,97,255,0.28)">
              <Sparkles size={11} aria-hidden /> {t('card.hiddenGem')}
            </Badge>
          )}
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
