'use client'
import { useState } from 'react'
import { Footprints, Loader2, MapPin, Route as RouteIcon } from 'lucide-react'
import GlassCard from './shared/GlassCard'
import Button from './ui/button'
import { parseErrandInput, orderStopsNearestNeighbor, ERRAND_MAX_CATEGORIES } from '../lib/errands'
import { haversineKm } from '../lib/distance'
import type { Place, SearchResponse } from './types'
import { useLanguage } from '../hooks/useLanguage'

interface Props {
  coords: { lat: number; lng: number } | null
}

interface PlannedStop {
  place: Place
  category: string
  walkMins: number
  legKm: number
  estimated: boolean
}

interface Leg {
  mins: number
  km: number
  estimated: boolean
}

/** Walk speed used when the /api/route leg lookup fails (4.5 km/h). */
const WALK_KMPH = 4.5

function estimateWalkKm(km: number): number {
  return (km / WALK_KMPH) * 60
}

/**
 * GET /api/route?from=lat,lng&to=lat,lng&mode=walk. Shape-tolerant: accepts
 * {durationMin|duration_min|durationMinutes, distanceKm|distance_km} — falls
 * back to a haversine estimate when the endpoint is missing or errors, so a
 * bad leg never breaks the plan.
 */
async function fetchLeg(from: { lat: number; lng: number }, to: { lat: number; lng: number }): Promise<Leg> {
  const straightKm = haversineKm(from.lat, from.lng, to.lat, to.lng)
  try {
    const url = `/api/route?from=${from.lat},${from.lng}&to=${to.lat},${to.lng}&mode=walk`
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) throw new Error('route unavailable')
    const body = (await res.json()) as Record<string, unknown>
    const minsRaw = body.durationMin ?? body.duration_min ?? body.durationMinutes
    const kmRaw = body.distanceKm ?? body.distance_km
    const mins = typeof minsRaw === 'number' && Number.isFinite(minsRaw) ? minsRaw : null
    const km = typeof kmRaw === 'number' && Number.isFinite(kmRaw) ? kmRaw : straightKm
    if (mins !== null) return { mins, km, estimated: false }
    return { mins: estimateWalkKm(km), km, estimated: true }
  } catch {
    return { mins: estimateWalkKm(straightKm), km: straightKm, estimated: true }
  }
}

function fmtMins(mins: number): string {
  return mins < 60 ? `${Math.round(mins)} min` : `${Math.floor(mins / 60)}h ${Math.round(mins % 60)}m`
}

export default function ErrandPlanner({ coords }: Props) {
  const { t } = useLanguage()
  const [input, setInput] = useState('')
  const [phase, setPhase] = useState<'idle' | 'searching' | 'routing'>('idle')
  const [phaseNote, setPhaseNote] = useState('')
  const [stops, setStops] = useState<PlannedStop[]>([])
  const [notes, setNotes] = useState<string[]>([])
  const [totalMins, setTotalMins] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const plan = async () => {
    if (!coords) return
    const categories = parseErrandInput(input)
    if (categories.length === 0) {
      setError(t('errand.empty'))
      return
    }
    setError(null)
    setStops([])
    setNotes([])
    setTotalMins(null)

    // Phase 1: nearest place per category (sequential; /api/search is server-cached).
    setPhase('searching')
    const found: { place: Place; category: string }[] = []
    const skipped: string[] = []
    for (const category of categories) {
      setPhaseNote(t('errand.searching', { category }))
      try {
        const res = await fetch('/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: category, lat: coords.lat, lng: coords.lng, radiusKm: 5 }),
        })
        if (!res.ok) throw new Error(`search failed (${res.status})`)
        const body = (await res.json()) as SearchResponse
        const places = Array.isArray(body.places) ? body.places : []
        if (places.length === 0) {
          skipped.push(category)
          continue
        }
        const nearest = [...places].sort(
          (a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity)
        )[0]
        found.push({ place: nearest, category })
      } catch {
        skipped.push(category)
      }
    }

    if (found.length === 0) {
      setPhase('idle')
      setPhaseNote('')
      setNotes(skipped.map(c => `No results for "${c}" — skipped.`))
      setError(t('errand.noResults'))
      return
    }

    // Phase 2: order stops, then fetch each walking leg.
    setPhase('routing')
    setPhaseNote(t('errand.routingNote'))
    const ordered = orderStopsNearestNeighbor(
      found.map(f => ({ id: f.place.id, lat: f.place.lat, lng: f.place.lng })),
      coords
    )
    const byId = new Map(found.map(f => [f.place.id, f]))
    const planned: PlannedStop[] = []
    let from = { lat: coords.lat, lng: coords.lng }
    for (const stop of ordered) {
      const entry = byId.get(stop.id)
      if (!entry) continue
      const leg = await fetchLeg(from, { lat: stop.lat, lng: stop.lng })
      planned.push({
        place: entry.place,
        category: entry.category,
        walkMins: leg.mins,
        legKm: leg.km,
        estimated: leg.estimated,
      })
      from = { lat: stop.lat, lng: stop.lng }
    }
    setStops(planned)
    setTotalMins(planned.reduce((sum, s) => sum + s.walkMins, 0))
    setNotes([
      ...skipped.map(c => `No results for "${c}" — skipped.`),
      ...(planned.some(s => s.estimated) ? [t('errand.estimatesNote')] : []),
    ])
    setPhase('idle')
    setPhaseNote('')
  }

  const busy = phase !== 'idle'

  return (
    <GlassCard style={{ padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
        <RouteIcon size={18} color="var(--accent)" />
        <h3 style={{ fontSize: '1.05rem' }}>{t('errand.title')}</h3>
      </div>
      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
        List up to {ERRAND_MAX_CATEGORIES} stops and I'll order them into the shortest
        walking route. Capped at {ERRAND_MAX_CATEGORIES} categories — each new category
        costs one search credit.
      </p>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <input
          aria-label={t('errand.inputAria')}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') plan() }}
          placeholder={t('errand.placeholder')}
          disabled={busy}
          style={{
            flex: 1, minWidth: 180,
            background: 'var(--input-bg)', border: '1px solid var(--input-border)',
            borderRadius: '12px', color: 'var(--text-primary)',
            padding: '12px 14px', fontSize: '0.9rem', fontFamily: "'Satoshi', sans-serif",
          }}
        />
        <Button variant="primary" onClick={plan} disabled={busy || !coords}>
          {busy ? <Loader2 size={16} style={{ animation: 'spin-slow 1.2s linear infinite' }} /> : null}
          {busy ? t('errand.planning') : t('errand.plan')}
        </Button>
      </div>
      {!coords && (
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '8px' }}>
          {t('errand.needLocation')}
        </p>
      )}
      {busy && phaseNote && (
        <p aria-live="polite" style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '10px' }}>
          {phaseNote}
        </p>
      )}
      {error && (
        <p role="alert" style={{ fontSize: '0.85rem', color: 'var(--error, #e5484d)', marginTop: '10px' }}>
          {error}
        </p>
      )}

      {stops.length > 0 && (
        <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {stops.map((s, i) => (
              <li
                key={s.place.id}
                style={{
                  display: 'flex', gap: '12px', alignItems: 'flex-start',
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: '14px', padding: '12px 14px',
                }}
              >
                <span
                  aria-hidden
                  style={{
                    flexShrink: 0, width: 28, height: 28, borderRadius: '50%',
                    background: 'var(--accent)', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.82rem', fontWeight: 700,
                  }}
                >
                  {i + 1}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                    {s.place.name}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {s.category}
                    {s.place.address ? ` · ${s.place.address}` : ''}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px', fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Footprints size={14} /> {s.estimated ? '~' : ''}{fmtMins(s.walkMins)} {t('errand.walkSuffix')}
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)' }}>
                      <MapPin size={14} /> {s.legKm.toFixed(1)} km
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ol>
          {totalMins !== null && (
            <p style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {t('errand.total', { time: `${stops.some(s => s.estimated) ? '~' : ''}${fmtMins(totalMins)}`, count: stops.length })}
            </p>
          )}
        </div>
      )}

      {notes.length > 0 && (
        <ul style={{ margin: '12px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {notes.map((n, i) => (
            <li key={i} style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{n}</li>
          ))}
        </ul>
      )}
    </GlassCard>
  )
}
