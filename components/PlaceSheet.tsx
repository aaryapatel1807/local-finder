'use client'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Car, ChevronDown, Copy, Footprints, Globe, Heart, MessageCircle, Navigation, Phone, Share2, Sparkles, X,
} from 'lucide-react'
import type { Place, ReviewSummary } from './types'
import { formatDistance } from './types'
import { StatusBadge, Stars, whatsappShareUrl } from './PlaceCard'
import Badge from './ui/badge'
import Button from './ui/button'
import Skeleton from './ui/skeleton'
import RouteBadge from './RouteBadge'
import { useRouteTime, type RouteMode } from '../hooks/useRouteTime'
import { useShell } from './shared/LayoutShell'
import { useLanguage } from '../hooks/useLanguage'

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
  /** Emergency mode: enlarges the Call button. */
  emergency?: boolean
}

/** CONTRACT NOTE: POST /api/reviews also returns `tags?: string[]`,
 *  `sentiment?: number` and `bestTimeHint?: string` (server contract),
 *  not yet in components/types.ts. */
interface ReviewsResponse extends ReviewSummary {
  tags?: string[]
  sentiment?: number
  bestTimeHint?: string
}

/** Server tag slugs → dictionary keys; unknown tags render as-is (kept English). */
export const TAG_LABELS: Record<string, string> = {
  'late-night': 'tag.lateNight',
  'family-friendly': 'tag.familyFriendly',
  budget: 'tag.budget',
  'quick-service': 'tag.quickService',
  hygienic: 'tag.hygienic',
  spacious: 'tag.spacious',
  parking: 'tag.parking',
  delivery: 'tag.delivery',
}

/** Translates a known tag slug; unknown tags render title-cased as-is. */
const tagLabel = (tag: string, t: (key: string) => string) =>
  TAG_LABELS[tag]
    ? t(TAG_LABELS[tag])
    : tag.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

/** AI review summary — lazy POST /api/reviews, hidden when aiDisabled or null summary. */
function ReviewSummarySection({
  place, aiDisabled, onAiDisabled, onReviewsLoaded,
}: {
  place: Place
  aiDisabled?: boolean
  onAiDisabled?: () => void
  onReviewsLoaded?: (placeId: string, sentiment?: number) => void
}) {
  const { t } = useLanguage()
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
    <section aria-label={t('sheet.reviewsSection')} style={{ marginTop: '16px' }}>
      <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 700, marginBottom: '8px' }}>
        <Sparkles size={14} style={{ color: 'var(--accent-purple)' }} />
        {t('sheet.fromReviews')}
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
            <p style={{ marginBottom: '4px' }}><strong style={{ color: '#16A34A' }}>{t('sheet.liked')}</strong> {summary.pros.join(' · ')}</p>
          )}
          {summary.cons && summary.cons.length > 0 && (
            <p style={{ marginBottom: '8px' }}><strong style={{ color: '#DC2626' }}>{t('sheet.complaints')}</strong> {summary.cons.join(' · ')}</p>
          )}
          {summary.tags && summary.tags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }} aria-label={t('sheet.goodFor')}>
              {summary.tags.map(tag => (
                <span key={tag} className="chip chip-purple" style={{ fontSize: '0.75rem' }}>
                  {tagLabel(tag, t)}
                </span>
              ))}
            </div>
          )}
          {summary.bestTimeHint && (
            <p style={{ marginBottom: '4px' }}>🕐 {t('sheet.bestTime', { hint: summary.bestTimeHint })}</p>
          )}
          {summary.basedOn ? (
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '6px' }}>
              {t('sheet.basedOn', { count: summary.basedOn })}
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
/** Ask about this place — POST /api/ask, answered from recent reviews.
 *  Hidden entirely when aiDisabled. */
function AskAboutPlace({
  place, aiDisabled, onAiDisabled,
}: {
  place: Place
  aiDisabled?: boolean
  onAiDisabled?: () => void
}) {
  const { t } = useLanguage()
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setQuestion('')
    setAnswer(null)
    setLoading(false)
    setError(null)
  }, [place?.id])

  if (aiDisabled) return null

  const ask = async (e: FormEvent) => {
    e.preventDefault()
    const q = question.trim()
    if (!q || loading) return
    setLoading(true)
    setError(null)
    setAnswer(null)
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataId: place.dataId, placeName: place.name, question: q }),
      })
      const data = await res.json().catch(() => null)
      if (data?.aiDisabled) {
        onAiDisabled?.()
        return
      }
      if (res.ok && typeof data?.answer === 'string' && data.answer.trim()) {
        setAnswer(data.answer)
      } else {
        setError(t('sheet.askError'))
      }
    } catch {
      setError(t('sheet.askError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <section aria-label={t('sheet.askAria', { name: place.name })} style={{ marginTop: '16px' }}>
      <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 700, marginBottom: '8px' }}>
        <MessageCircle size={14} style={{ color: 'var(--accent-purple)' }} aria-hidden />
        {t('sheet.askTitle')}
      </h4>
      <form onSubmit={ask} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <input
          type="text"
          value={question}
          onChange={e => setQuestion(e.target.value)}
          placeholder={t('sheet.askPlaceholder')}
          aria-label={t('sheet.askInputAria')}
          enterKeyHint="send"
          style={{
            flex: 1, minWidth: 0,
            background: 'var(--input-bg)', border: '1px solid var(--input-border)',
            borderRadius: '12px', color: 'var(--text-primary)',
            padding: '10px 12px', fontSize: '0.85rem', fontFamily: "'Satoshi', sans-serif",
          }}
        />
        <Button type="submit" variant="primary" disabled={!question.trim() || loading} style={{ padding: '10px 16px' }}>
          {loading ? '…' : t('sheet.askSubmit')}
        </Button>
      </form>
      {loading && (
        <div style={{ marginTop: '8px' }} aria-live="polite">
          <Skeleton style={{ height: 12, width: '90%' }} />
        </div>
      )}
      {error && (
        <div role="alert" style={{ fontSize: '0.82rem', color: '#DC2626', marginTop: '8px' }}>
          {error}
        </div>
      )}
      {answer && (
        <div style={{ marginTop: '10px' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
            {t('sheet.fromReviews')}
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-faint)', lineHeight: 1.55 }}>{answer}</p>
        </div>
      )}
    </section>
  )
}

/** Photos — tap-to-load only (never auto-fetched). Hidden when there is no
 *  dataId or the server reports quota pressure (503 QUOTA_NEAR_LIMIT). */
function PhotosSection({ place }: { place: Place }) {
  const { t } = useLanguage()
  const [photos, setPhotos] = useState<string[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    setPhotos(null)
    setLoading(false)
    setError(false)
    setHidden(false)
  }, [place?.id])

  if (!place.dataId || hidden) return null

  const load = async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch(`/api/photos?dataId=${encodeURIComponent(place.dataId as string)}`)
      if (res.status === 503) {
        setHidden(true) // quota pressure — hide the section entirely
        return
      }
      const body = await res.json().catch(() => null)
      const raw = body?.photos ?? body
      const urls = Array.isArray(raw)
        ? raw.map((p: unknown) => (typeof p === 'string' ? p : (p as { url?: string } | null)?.url)).filter((u): u is string => !!u)
        : []
      if (!res.ok || urls.length === 0) {
        setError(true)
      } else {
        setPhotos(urls)
      }
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section aria-label={t('sheet.photosOf', { name: place.name })} style={{ marginTop: '16px' }}>
      <h4 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '8px' }}>{t('sheet.photos')}</h4>
      {photos === null && !loading && !error && (
        <Button variant="ghost" onClick={load} style={{ fontSize: '0.82rem' }}>
          {t('sheet.loadPhotos')}
        </Button>
      )}
      {loading && (
        <div style={{ display: 'flex', gap: '8px' }} aria-live="polite">
          {[0, 1, 2].map(i => <Skeleton key={i} style={{ height: 120, width: 160, borderRadius: '14px', flexShrink: 0 }} />)}
        </div>
      )}
      {error && (
        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          {t('sheet.photosError')}{' '}
          <button
            type="button"
            onClick={load}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-deep)', fontSize: '0.82rem', fontWeight: 600, fontFamily: "'Satoshi', sans-serif", textDecoration: 'underline' }}
          >
            {t('sheet.retry')}
          </button>
        </div>
      )}
      {photos && photos.length > 0 && (
        <div
          style={{
            display: 'flex', gap: '8px', overflowX: 'auto',
            scrollSnapType: 'x mandatory', paddingBottom: '4px',
          }}
        >
          {photos.map((u, i) => (
            <img
              key={i}
              src={u}
              alt={t('sheet.photoAlt', { name: place.name, n: i + 1 })}
              loading="lazy"
              style={{ width: 160, height: 120, objectFit: 'cover', borderRadius: '14px', scrollSnapAlign: 'start', flexShrink: 0 }}
            />
          ))}
        </div>
      )}
    </section>
  )
}
export default function PlaceSheet({
  place, onClose, isFavorite, onToggleFavorite, onShare, aiDisabled, onAiDisabled,
  onReviewsLoaded, userCoords, emergency,
}: PlaceSheetProps) {
  const { collapsed, isMobile } = useShell()
  const { t } = useLanguage()
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
    <motion.div
      key="place-sheet"
      initial={isMobile ? { y: 48, opacity: 0 } : { x: 48, opacity: 0 }}
      animate={{ x: 0, y: 0, opacity: 1 }}
      exit={isMobile ? { y: 48, opacity: 0 } : { x: 48, opacity: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
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
        aria-label={t('sheet.details', { name: place.name })}
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
            aria-label={t('sheet.close')}
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
              alt={t('sheet.photoOf', { name: place.name })}
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
              aria-label={t('sheet.openInMaps', { name: place.name })}
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
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t('card.reviews', { count: place.reviews.toLocaleString() })}</span>
            )}
            {place.price && (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>{place.price}</span>
            )}
          </div>

          {/* open status + hours */}
          <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <StatusBadge place={place} />
              {place.source === 'osm' && (
                <Badge color="var(--text-muted)" background="var(--track)" border="var(--border)">
                  {t('badges.communityData')}
                </Badge>
              )}
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
                  {t('sheet.weeklyHours')}
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
                aria-label={t('sheet.copyAddress')}
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
          {copied && <div role="status" style={{ fontSize: '0.75rem', color: 'var(--accent-deep)', marginTop: '4px' }}>{t('sheet.addressCopied')}</div>}

          {place.distanceKm !== undefined && (
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '8px' }}>
              {t('sheet.away', { distance: formatDistance(place.distanceKm) })}
            </div>
          )}

          {/* route time with walk/drive toggle */}
          {userCoords && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
              <div role="group" aria-label={t('sheet.routeMode')} style={{ display: 'inline-flex', gap: '6px' }}>
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
                      <Icon size={13} aria-hidden /> {t(m === 'walk' ? 'sheet.walk' : 'sheet.drive')}
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
              <a href={`tel:${place.phone}`} aria-label={t('sheet.callAria', { name: place.name })}>
                <Button
                  variant="ghost"
                  className="w-full"
                  style={{
                    flexDirection: 'column', gap: 4,
                    padding: emergency ? '18px 8px' : '12px 8px',
                    fontSize: emergency ? '0.88rem' : '0.75rem',
                    fontWeight: emergency ? 700 : undefined,
                  }}
                >
                  <Phone size={emergency ? 24 : 18} /> {t('sheet.call')}
                </Button>
              </a>
            )}
            <a href={directionsUrl} target="_blank" rel="noopener noreferrer" aria-label={t('sheet.directionsAria', { name: place.name })}>
              <Button variant="ghost" className="w-full" style={{ flexDirection: 'column', gap: 4, padding: '12px 8px', fontSize: '0.75rem' }}>
                <Navigation size={18} /> {t('sheet.directions')}
              </Button>
            </a>
            {place.website && (
              <a href={place.website} target="_blank" rel="noopener noreferrer" aria-label={t('sheet.websiteAria', { name: place.name })}>
                <Button variant="ghost" className="w-full" style={{ flexDirection: 'column', gap: 4, padding: '12px 8px', fontSize: '0.75rem' }}>
                  <Globe size={18} /> {t('sheet.website')}
                </Button>
              </a>
            )}
            <Button
              variant="ghost"
              onClick={() => onToggleFavorite(place)}
              aria-pressed={isFavorite}
              style={{ flexDirection: 'column', gap: 4, padding: '12px 8px', fontSize: '0.75rem', color: isFavorite ? '#E14E42' : undefined }}
            >
              <Heart size={18} fill={isFavorite ? '#E14E42' : 'transparent'} /> {t(isFavorite ? 'sheet.saved' : 'sheet.save')}
            </Button>
            <Button
              variant="ghost"
              onClick={() => onShare(place)}
              aria-label={t('sheet.shareAria', { name: place.name })}
              style={{ flexDirection: 'column', gap: 4, padding: '12px 8px', fontSize: '0.75rem' }}
            >
              <Share2 size={18} /> {t('sheet.share')}
            </Button>
            <a
              href={whatsappShareUrl(place)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t('sheet.whatsappAria', { name: place.name })}
            >
              <Button variant="ghost" className="w-full" style={{ flexDirection: 'column', gap: 4, padding: '12px 8px', fontSize: '0.75rem' }}>
                <MessageCircle size={18} /> {t('sheet.whatsapp')}
              </Button>
            </a>
          </div>

          <PhotosSection place={place} />

          <ReviewSummarySection place={place} aiDisabled={aiDisabled} onAiDisabled={onAiDisabled} onReviewsLoaded={onReviewsLoaded} />

          <AskAboutPlace place={place} aiDisabled={aiDisabled} onAiDisabled={onAiDisabled} />

          <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '18px', lineHeight: 1.5 }}>
            {t('sheet.privacy')}
          </p>
        </div>
      </div>
    </motion.div>
  )
}
