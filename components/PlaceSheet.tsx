'use client'
import { useEffect, useMemo, useState } from 'react'
import {
  Car, ChevronDown, Copy, Footprints, Globe, Heart, Navigation, Phone, Share2, Sparkles, X,
} from 'lucide-react'
import type { Place, ReviewSummary } from './types'
import { formatDistance } from './types'
import { StatusBadge, Stars } from './PlaceCard'
import Button from './ui/button'
import Skeleton from './ui/skeleton'
import RouteBadge from './RouteBadge'
import { useRouteTime, type RouteMode } from '../hooks/useRouteTime'
import { useShell } from './shared/LayoutShell'

interface PlaceSheetProps {
  place: Place | null
  onClose: () => void
  isFavorite: boolean
  onToggleFavorite: (place: Place) => void
  onShare: (place: Place) => void
  aiDisabled?: boolean
  onAiDisabled?: () => void
  /** Called when the review summary arrives (placeId + optional sentiment for best-sort blending). */
  onReviewsLoaded?: (placeId: string, sentiment?: number) => void
  /** Optional user location — enables the walk/drive route time. */
  userCoords?: { lat: number; lng: number } | null
}

/** CONTRACT NOTE: POST /api/reviews also returns `tags?: string[]` and
 *  `sentiment?: number` (server contract), not yet in components/types.ts. */
interface ReviewsResponse extends ReviewSummary {
  tags?: string[]
  sentiment?: number
}

/** Server tag slugs → human labels; unknown tags render as-is. */
export const TAG_LABELS: Record<string, string> = {
  'late-night': 'Open late',
  'family-friendly': 'Family friendly',
  budget: 'Budget',
  'quick-service': 'Quick service',
  hygienic: 'Hygienic',
  spacious: 'Spacious',
  parking: 'Parking',
  delivery: 'Delivery',
}

const tagLabel = (tag: string) =>
  TAG_LABELS[tag] ?? tag.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

/** AI review summary — lazy POST /api/reviews, hidden when aiDisabled or null summary. */
function ReviewSummarySection({
  place, aiDisabled, onAiDisabled, onReviewsLoaded,
}: {
  place: Place
  aiDisabled?: boolean
  onAiDisabled?: () => void
  onReviewsLoaded?: (placeId: string, sentiment?: number) => void
}) {
  const [summary, setSummary] = useState<ReviewsResponse | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (aiDisabled) return
    let cancelled = false
    setLoading(true)
    setSummary(null)
    fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataId: place.dataId ?? place.id, placeName: place.name }),
    })
      .then(res => (res.ok ? res.json() : null))
      .then((data: ReviewsResponse | null) => {
        if (cancelled) return
        setLoading(false)
        if (data?.aiDisabled) {
          onAiDisabled?.()
          return
        }
        if (data && data.summary) setSummary(data)
        if (data) onReviewsLoaded?.(place.id, data.sentiment)
      })
      .catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place.id, place.dataId, place.name, aiDisabled])

  if (aiDisabled) return null
  if (!loading && !summary) return null // hidden entirely when the summary is null

  return (
    <section aria-label="AI review summary" style={{ marginTop: '16px' }}>
      <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 700, marginBottom: '8px' }}>
        <Sparkles size={14} style={{ color: 'var(--accent-purple)' }} />
        From recent reviews
      </h4>
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <Skeleton style={{ height: 12, width: '100%' }} />
          <Skeleton style={{ height: 12, width: '85%' }} />
        </div>
      ) : summary ? (
        <div style={{ fontSize: '0.85rem', color: 'var(--text-faint)', lineHeight: 1.55 }}>
          <p style={{ marginBottom: '8px' }}>{summary.summary}</p>
          {summary.pros && summary.pros.length > 0 && (
            <p style={{ marginBottom: '4px' }}><strong style={{ color: '#16A34A' }}>Liked:</strong> {summary.pros.join(' · ')}</p>
          )}
          {summary.cons && summary.cons.length > 0 && (
            <p style={{ marginBottom: '8px' }}><strong style={{ color: '#DC2626' }}>Complaints:</strong> {summary.cons.join(' · ')}</p>
          )}
          {summary.tags && summary.tags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }} aria-label="Good for">
              {summary.tags.map(t => (
                <span key={t} className="chip chip-purple" style={{ fontSize: '0.75rem' }}>
                  {tagLabel(t)}
                </span>
              ))}
            </div>
          )}
          {summary.basedOn ? (
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '6px' }}>
              Based on {summary.basedOn} reviews
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

/**
 * Details sheet: bottom sheet on mobile, sidebar-aware side panel on desktop
 * (NutriAI overlay convention — sits beside the sidebar, widens when it collapses).
 */
export default function PlaceSheet({
  place, onClose, isFavorite, onToggleFavorite, onShare, aiDisabled, onAiDisabled,
  onReviewsLoaded, userCoords,
}: PlaceSheetProps) {
  const { collapsed, isMobile } = useShell()
  const [hoursOpen, setHoursOpen] = useState(false)
  const [imgFailed, setImgFailed] = useState(false)
  const [copied, setCopied] = useState(false)
  const [routeMode, setRouteMode] = useState<RouteMode>('walk')

  useEffect(() => {
    setHoursOpen(false)
    setImgFailed(false)
    setCopied(false)
    setRouteMode('walk')
  }, [place?.id])

  const places = useMemo(() => (place ? [place] : []), [place])
  const routes = useRouteTime(userCoords, places, routeMode)

  // Escape to close.
  useEffect(() => {
    if (!place) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [place, onClose])

  if (!place) return null

  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`
  const mapsSearchUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}&query_place_id=${encodeURIComponent(place.id)}`

  const copyAddress = async () => {
    if (!place.address) return
    try {
      await navigator.clipboard.writeText(place.address)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {}
  }

  const weeklyHours = place.weeklyHours ? Object.entries(place.weeklyHours) : []

  const panelStyle: React.CSSProperties = isMobile
    ? {
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 120,
        maxHeight: '86vh', display: 'flex', flexDirection: 'column',
        borderRadius: '26px 26px 0 0',
      }
    : {
        position: 'fixed',
        top: '96px', bottom: '24px', right: '24px',
        left: collapsed ? '24px' : '284px', // 260px sidebar + 24px gutter
        width: 'auto',
        maxWidth: collapsed ? 520 : 440, // widens when the sidebar is minimised
        marginLeft: 'auto',
        zIndex: 120,
        display: 'flex', flexDirection: 'column',
        borderRadius: '26px',
      }

  return (
    <>
      {/* scrim — mobile only; desktop panel sits beside the content */}
      {isMobile && (
        <div
          onClick={onClose}
          aria-hidden
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 110 }}
        />
      )}
      <div
        role="dialog"
        aria-modal={isMobile}
        aria-label={`${place.name} details`}
        className="app-chrome"
        style={{
          ...panelStyle,
          background: 'var(--glass-bg)',
          border: '1px solid var(--glass-border)',
          boxShadow: 'var(--glass-shadow), inset 0 1px 0 var(--glass-highlight)',
          overflow: 'hidden',
        }}
      >
        <div style={{ overflowY: 'auto', flex: 1, padding: '20px' }}>
          {/* close */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close details"
            style={{
              position: 'absolute', top: '12px', right: '12px', zIndex: 2,
              background: 'var(--track)', border: '1px solid var(--border)',
              borderRadius: '50%', width: 32, height: 32,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-primary)', cursor: 'pointer',
            }}
          >
            <X size={16} />
          </button>

          {place.thumbnail && !imgFailed ? (
            <img
              src={place.thumbnail}
              alt={`Photo of ${place.name}`}
              loading="lazy"
              onError={() => setImgFailed(true)}
              style={{ width: '100%', height: 180, borderRadius: '18px', objectFit: 'cover', marginBottom: '14px', display: 'block' }}
            />
          ) : null}

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{ fontSize: '1.25rem', lineHeight: 1.3 }}>{place.name}</h2>
              {place.category && (
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>{place.category}</div>
              )}
            </div>
            <a
              href={mapsSearchUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open ${place.name} in Google Maps`}
              style={{ color: 'var(--text-muted)', padding: '4px', flexShrink: 0 }}
            >
              <Globe size={16} />
            </a>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
            <Stars rating={place.rating} />
            {place.rating !== undefined && place.rating !== null && (
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{place.rating.toFixed(1)}</span>
            )}
            {place.reviews !== undefined && place.reviews !== null && (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{place.reviews.toLocaleString()} reviews</span>
            )}
            {place.price && (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>{place.price}</span>
            )}
          </div>

          {/* open status + hours */}
          <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <StatusBadge place={place} />
              {place.hoursToday && (
                <span style={{ fontSize: '0.82rem', color: 'var(--text-faint)' }}>{place.hoursToday}</span>
              )}
            </div>
            {weeklyHours.length > 0 && (
              <div>
                <button
                  type="button"
                  onClick={() => setHoursOpen(o => !o)}
                  aria-expanded={hoursOpen}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0',
                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                    color: 'var(--accent-deep)', fontSize: '0.82rem', fontWeight: 600,
                    fontFamily: "'Satoshi', sans-serif",
                  }}
                >
                  Weekly hours
                  <ChevronDown size={14} style={{ transform: hoursOpen ? 'rotate(180deg)' : undefined, transition: 'transform 0.2s' }} />
                </button>
                {hoursOpen && (
                  <dl style={{ marginTop: '6px', fontSize: '0.82rem', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px' }}>
                    {weeklyHours.map(([day, hours]) => (
                      <div key={day} style={{ display: 'contents' }}>
                        <dt style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{day}</dt>
                        <dd style={{ color: 'var(--text-primary)' }}>{hours}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            )}
          </div>

          {/* address with copy */}
          {place.address && (
            <div style={{ marginTop: '12px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
              <p style={{ flex: 1, fontSize: '0.85rem', color: 'var(--text-faint)', lineHeight: 1.5 }}>{place.address}</p>
              <button
                type="button"
                onClick={copyAddress}
                aria-label="Copy address"
                style={{
                  background: 'var(--track)', border: '1px solid var(--border)', borderRadius: '10px',
                  padding: '7px', color: 'var(--text-primary)', cursor: 'pointer', flexShrink: 0,
                  display: 'flex', alignItems: 'center',
                }}
              >
                <Copy size={14} />
              </button>
            </div>
          )}
          {copied && <div role="status" style={{ fontSize: '0.75rem', color: 'var(--accent-deep)', marginTop: '4px' }}>Address copied</div>}

          {place.distanceKm !== undefined && (
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '8px' }}>
              {formatDistance(place.distanceKm)} away
            </div>
          )}

          {/* route time with walk/drive toggle */}
          {userCoords && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
              <div role="group" aria-label="Route mode" style={{ display: 'inline-flex', gap: '6px' }}>
                {(['walk', 'drive'] as RouteMode[]).map(m => {
                  const active = routeMode === m
                  const Icon = m === 'walk' ? Footprints : Car
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setRouteMode(m)}
                      aria-pressed={active}
                      className={active ? 'chip chip-green' : 'chip chip-muted'}
                      style={{ cursor: 'pointer', fontFamily: "'Satoshi', sans-serif", display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                    >
                      <Icon size={13} aria-hidden /> {m === 'walk' ? 'Walk' : 'Drive'}
                    </button>
                  )
                })}
              </div>
              <RouteBadge route={routes.get(place.id)} mode={routeMode} />
            </div>
          )}

          {/* action row */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(64px, 1fr))',
              gap: '8px',
              marginTop: '16px',
            }}
          >
            {place.phone && (
              <a href={`tel:${place.phone}`} aria-label={`Call ${place.name}`}>
                <Button variant="ghost" className="w-full" style={{ flexDirection: 'column', gap: 4, padding: '12px 8px', fontSize: '0.75rem' }}>
                  <Phone size={18} /> Call
                </Button>
              </a>
            )}
            <a href={directionsUrl} target="_blank" rel="noopener noreferrer" aria-label={`Get directions to ${place.name}`}>
              <Button variant="ghost" className="w-full" style={{ flexDirection: 'column', gap: 4, padding: '12px 8px', fontSize: '0.75rem' }}>
                <Navigation size={18} /> Directions
              </Button>
            </a>
            {place.website && (
              <a href={place.website} target="_blank" rel="noopener noreferrer" aria-label={`Visit ${place.name} website`}>
                <Button variant="ghost" className="w-full" style={{ flexDirection: 'column', gap: 4, padding: '12px 8px', fontSize: '0.75rem' }}>
                  <Globe size={18} /> Website
                </Button>
              </a>
            )}
            <Button
              variant="ghost"
              onClick={() => onToggleFavorite(place)}
              aria-pressed={isFavorite}
              style={{ flexDirection: 'column', gap: 4, padding: '12px 8px', fontSize: '0.75rem', color: isFavorite ? '#E14E42' : undefined }}
            >
              <Heart size={18} fill={isFavorite ? '#E14E42' : 'transparent'} /> {isFavorite ? 'Saved' : 'Save'}
            </Button>
            <Button
              variant="ghost"
              onClick={() => onShare(place)}
              aria-label={`Share ${place.name}`}
              style={{ flexDirection: 'column', gap: 4, padding: '12px 8px', fontSize: '0.75rem' }}
            >
              <Share2 size={18} /> Share
            </Button>
          </div>

          <ReviewSummarySection place={place} aiDisabled={aiDisabled} onAiDisabled={onAiDisabled} onReviewsLoaded={onReviewsLoaded} />

          <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '18px', lineHeight: 1.5 }}>
            Your location is sent to our server only to find places near you.
          </p>
        </div>
      </div>
    </>
  )
}
