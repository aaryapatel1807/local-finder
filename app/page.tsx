'use client'
import { FormEvent, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { ArrowUp, List, LocateFixed, Map as MapIcon, MapPin, X } from 'lucide-react'
import ScenicBackdrop from '../components/shared/ScenicBackdrop'
import GlassCard from '../components/shared/GlassCard'
import { useLocation } from '../components/shared/LocationContext'
import SearchBar from '../components/SearchBar'
import CategoryChips from '../components/CategoryChips'
import FilterBar, { type PriceBand, type SortKeyExt } from '../components/FilterBar'
import PlaceCard from '../components/PlaceCard'
import PlaceSheet from '../components/PlaceSheet'
import MapView from '../components/MapView'
import SkeletonCard from '../components/SkeletonCard'
import EmptyState from '../components/EmptyState'
import ErrorState from '../components/ErrorState'
import Toast from '../components/Toast'
import AmbiguityChips from '../components/AmbiguityChips'
import AnswerCard from '../components/AnswerCard'
import CompareTable from '../components/CompareTable'
import LocationPicker, { PINNED_STORAGE_KEY } from '../components/LocationPicker'
import Button from '../components/ui/button'
import { useGeolocation, CITY_FALLBACKS, type CityOption, type Coords } from '../hooks/useGeolocation'
import { useSearch } from '../hooks/useSearch'
import { useFavorites } from '../hooks/useFavorites'
import { useLocalStorage } from '../hooks/useLocalStorage'
import type { Place, ParseResponse, ParsedQueryResult } from '../components/types'
import { mapParseSort, sortPlaces } from '../components/types'
import { isQuestionLike } from '../lib/question'
import { blendSentiment } from '../lib/score'

/**
 * CONTRACT NOTE: components/types.ts carries the Phase 2 fields
 * (ParsedQueryResult.ambiguous, ReviewSummary.tags/sentiment, SortKey
 * 'foryou') and lib/score.ts exports blendSentiment (per the server
 * contract). The local extensions below (AmbiguousParsed, SortKeyExt)
 * are written to compile with or without those fields present.
 */
interface AmbiguousParsed extends ParsedQueryResult {
  ambiguous?: { term: string; options: { label: string; query: string }[] }
}

interface AmbiguityState {
  term: string
  options: { label: string; query: string }[]
  originalText: string
  openNow?: boolean
  sort?: ParsedQueryResult['sort']
  near?: string
}

interface AnswerState {
  placeName: string
  reasons: string[]
  summary?: string | null
}

function matchesPriceBand(price: string | undefined, band: PriceBand): boolean {
  if (band === 'any') return true
  if (!price) return false
  if (band === '₹') return price === '₹'
  if (band === '₹₹') return price === '₹₹'
  return price.length >= 3 // '₹₹₹+': three or more ₹ symbols
}

function readPinnedLocation(): Coords | null {
  try {
    const raw = window.localStorage.getItem(PINNED_STORAGE_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as { lat?: unknown; lng?: unknown }
    if (typeof p?.lat === 'number' && typeof p?.lng === 'number' && Number.isFinite(p.lat) && Number.isFinite(p.lng)) {
      return { lat: p.lat, lng: p.lng }
    }
  } catch {}
  return null
}

function HomeContent() {
  const searchParams = useSearchParams()
  const { locationLabel, setLocationLabel, radiusKm, setRadiusKm } = useLocation()
  const {
    coords, status: geoStatus, error: geoError, requestLocation, setCoords, accuracyMeters,
  } = useGeolocation()
  const { favorites, isFavorite, toggle } = useFavorites()
  // The sibling's /api/health does not carry an aiDisabled flag; the AI routes
  // report it per-call instead, so we learn it lazily and hide AI UI after.
  const [aiDisabled, setAiDisabled] = useState(false)

  const [input, setInput] = useState('')
  const [submittedQuery, setSubmittedQuery] = useState('')
  const [openNow, setOpenNow] = useState(false)
  const [sort, setSort] = useState<SortKeyExt>('best')
  const [priceBand, setPriceBand] = useState<PriceBand>('any')
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list')
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null)
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const [showBackToTop, setShowBackToTop] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [parsing, setParsing] = useState(false)
  const [pendingPlaceId, setPendingPlaceId] = useState<string | null>(null)
  const [recentSearches, setRecentSearches] = useLocalStorage<string[]>('localfinder_recent_searches', [])
  const [urlInitDone, setUrlInitDone] = useState(false)

  // ── Phase 2: ambiguity, anchor, answer, compare, picker ──────────────────
  const [ambiguity, setAmbiguity] = useState<AmbiguityState | null>(null)
  const [anchor, setAnchor] = useState<{ label: string } | null>(null)
  const [answer, setAnswer] = useState<AnswerState | null>(null)
  const [answerLoading, setAnswerLoading] = useState(false)
  const [compareMode, setCompareMode] = useState(false)
  const [compareIds, setCompareIds] = useState<string[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [cityInput, setCityInput] = useState('')
  const sentimentCacheRef = useRef(new Map<string, number>())
  const [sentimentTick, setSentimentTick] = useState(0)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2400)
  }, [])

  // ── URL prefill (?q=&lat=&lng=&r=) — share links ──────────────────────────
  useEffect(() => {
    if (urlInitDone) return
    setUrlInitDone(true)
    const q = searchParams.get('q')
    const lat = searchParams.get('lat')
    const lng = searchParams.get('lng')
    const r = searchParams.get('r')
    const placeId = searchParams.get('place')
    if (r) {
      const rn = Number(r)
      if ([1, 3, 5, 10].includes(rn)) setRadiusKm(rn)
    }
    if (lat && lng && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))) {
      setCoords({ lat: Number(lat), lng: Number(lng) })
      setLocationLabel('Shared location')
    } else {
      // Pinned location (set on the map earlier) wins over a fresh geo fix.
      const pin = readPinnedLocation()
      if (pin) {
        setCoords(pin)
        setLocationLabel('Pinned location')
      } else {
        requestLocation() // browser location prompt on open (spec flow step 1)
      }
    }
    if (q) {
      setInput(q)
      setSubmittedQuery(q)
    }
    if (placeId) setPendingPlaceId(placeId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Geolocation side effects ─────────────────────────────────────────────
  useEffect(() => {
    if (geoStatus === 'granted' && locationLabel !== 'Near you' && !searchParams.get('lat')) {
      setLocationLabel('Near you')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geoStatus])

  useEffect(() => {
    if (geoStatus === 'denied' && !coords && !readPinnedLocation()) {
      // City fallback, default Vadodara (spec 2.1).
      const vadodara = CITY_FALLBACKS[0]
      setCoords({ lat: vadodara.lat, lng: vadodara.lng })
      setLocationLabel(vadodara.name)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geoStatus])

  // ── Search ───────────────────────────────────────────────────────────────
  const search = useSearch({
    query: submittedQuery,
    lat: coords?.lat ?? NaN,
    lng: coords?.lng ?? NaN,
    radiusKm,
  })

  const runSearch = useCallback((q: string) => {
    const query = q.trim()
    if (!query) return
    setSubmittedQuery(query)
    setInput(query)
    setViewMode('list')
    setRecentSearches(prev => [query, ...prev.filter(r => r.toLowerCase() !== query.toLowerCase())].slice(0, 5))
  }, [setRecentSearches])

  // ── AI answer for question-like queries (POST /api/answer) ───────────────
  const fetchAnswer = useCallback(async (text: string) => {
    if (!coords || aiDisabled) return // no card without coords
    setAnswerLoading(true)
    setAnswer(null)
    try {
      const res = await fetch('/api/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, lat: coords.lat, lng: coords.lng, radiusKm }),
      })
      const body = await res.json().catch(() => null)
      if (body?.aiDisabled) {
        setAiDisabled(true)
        return
      }
      const a = body?.answer
      if (res.ok && a?.place) {
        setAnswer({
          placeName: typeof a.place === 'string' ? a.place : (a.place?.name ?? 'Top pick'),
          reasons: Array.isArray(a.reasons) ? a.reasons : [],
          summary: typeof a.summary === 'string' ? a.summary : null,
        })
      }
      // answer null or AI disabled → the normal search (already running) stands alone
    } catch {
      /* fall back to normal search */
    } finally {
      setAnswerLoading(false)
    }
  }, [coords, radiusKm, aiDisabled])

  /** Unified submit: question-like queries also fetch the AI answer card. */
  const submitSearch = useCallback((text: string) => {
    const t = text.trim()
    if (!t) return
    if (isQuestionLike(t)) {
      void fetchAnswer(t)
    } else {
      setAnswer(null)
      setAnswerLoading(false)
    }
    runSearch(t)
  }, [fetchAnswer, runSearch])

  // ── Results: open-now + price filters + client-side sort (no new API call) ─
  const results = useMemo(() => {
    let places = search.data?.places ?? []
    if (openNow) places = places.filter(p => p.isOpen === true)
    if (priceBand !== 'any') places = places.filter(p => matchesPriceBand(p.price, priceBand))
    if (sort === 'best' || sort === 'foryou') {
      // 'foryou' behaves like 'best' until the personalized rerank hook lands.
      const scored = places.map(p => ({
        p,
        s: blendSentiment(p.score ?? 0, sentimentCacheRef.current.get(p.id)),
      }))
      scored.sort((x, y) => y.s - x.s)
      return scored.slice(0, 20).map(x => x.p)
    }
    return sortPlaces(places, sort)
  }, [search.data, openNow, sort, priceBand, sentimentTick])

  // Sentiment from loaded review summaries feeds the best-sort blend.
  const handleReviewsLoaded = useCallback((placeId: string, sentiment?: number) => {
    if (typeof sentiment !== 'number' || !Number.isFinite(sentiment)) return
    if (sentimentCacheRef.current.get(placeId) !== sentiment) {
      sentimentCacheRef.current.set(placeId, sentiment)
      setSentimentTick(t => t + 1)
    }
  }, [])

  // Match the answer card's place back to a result for "View details".
  const answerPlaceMatch = useMemo(() => {
    if (!answer) return null
    const name = answer.placeName.toLowerCase()
    return results.find(p => p.name.toLowerCase() === name)
      ?? results.find(p =>
        p.name.toLowerCase().includes(name) ||
        (name.length > 3 && name.includes(p.name.toLowerCase()))
      )
      ?? null
  }, [answer, results])

  // ── Compare ──────────────────────────────────────────────────────────────
  const toggleCompare = useCallback((place: Place) => {
    setCompareIds(prev => {
      if (prev.includes(place.id)) return prev.filter(id => id !== place.id)
      if (prev.length >= 2) {
        showToast('Pick up to two places to compare')
        return prev
      }
      return [...prev, place.id]
    })
  }, [showToast])

  const comparePlaces = useMemo(() => {
    if (compareIds.length !== 2) return null
    const [x, y] = compareIds.map(id => results.find(p => p.id === id))
    return x && y ? ([x, y] as [Place, Place]) : null
  }, [compareIds, results])

  const clearCompare = useCallback(() => setCompareIds([]), [])

  // ── "near" anchor: geocode the AI-parsed near field ──────────────────────
  const resolveNear = useCallback(async (near: string) => {
    const q = near.trim()
    if (!q) return
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`)
      if (res.ok) {
        const g = await res.json().catch(() => null)
        if (g && Number.isFinite(g.lat) && Number.isFinite(g.lng)) {
          setCoords({ lat: g.lat, lng: g.lng })
          const label = typeof g.label === 'string' && g.label ? g.label : q
          setLocationLabel(`near ${label}`)
          setAnchor({ label })
          showToast(`Searching near ${label}`)
          return
        }
      }
      // 404 NO_RESULTS or bad payload → keep current location
      showToast(`Couldn't find "${q}" — using your current location`)
    } catch {
      showToast(`Couldn't find "${q}" — using your current location`)
    }
  }, [setCoords, setLocationLabel, showToast])

  const clearAnchor = useCallback(() => {
    setAnchor(null)
    setLocationLabel('Near you')
    requestLocation()
  }, [requestLocation, setLocationLabel])

  const useMyLocation = useCallback(() => {
    setAnchor(null)
    requestLocation()
  }, [requestLocation])

  // ── City text input fallback (replaces the hardcoded city select) ─────────
  const submitCity = useCallback(async (e: FormEvent) => {
    e.preventDefault()
    const q = cityInput.trim()
    if (!q) return
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`)
      if (res.ok) {
        const g = await res.json().catch(() => null)
        if (g && Number.isFinite(g.lat) && Number.isFinite(g.lng)) {
          setCoords({ lat: g.lat, lng: g.lng })
          setLocationLabel(typeof g.label === 'string' && g.label ? g.label : q)
          setAnchor(null)
          setCityInput('')
          showToast(`Showing results for ${typeof g.label === 'string' && g.label ? g.label : q}`)
          return
        }
      }
      showToast(`Couldn't find "${q}" — try another city`)
    } catch {
      showToast('Could not look up that city')
    }
  }, [cityInput, setCoords, setLocationLabel, showToast])

  const pickCity = useCallback((city: CityOption) => {
    setCoords({ lat: city.lat, lng: city.lng })
    setLocationLabel(city.name)
    setAnchor(null)
  }, [setCoords, setLocationLabel])

  // ── Pinned location (set on the map) ─────────────────────────────────────
  const handlePinConfirm = useCallback((c: Coords) => {
    setCoords(c)
    setLocationLabel('Pinned location')
    setAnchor(null)
    setPickerOpen(false)
    showToast('Pinned location set')
  }, [setCoords, setLocationLabel, showToast])

  // ── Emergency mode ───────────────────────────────────────────────────────
  const emergencySearch = useCallback(() => {
    setOpenNow(true)
    setSort('nearest')
    runSearch('pharmacy')
    showToast('Showing open pharmacies & clinics nearest you')
  }, [runSearch, showToast])

  // Auto-open a shared place link once results arrive.
  useEffect(() => {
    if (pendingPlaceId && search.data?.places) {
      const found = search.data.places.find(p => p.id === pendingPlaceId)
      if (found) setSelectedPlace(found)
      setPendingPlaceId(null)
    }
  }, [pendingPlaceId, search.data])

  // ── Marker → card: switch to list, scroll + highlight ─────────────────────
  const handleMarkerSelect = useCallback((id: string) => {
    setViewMode('list')
    setHighlightId(id)
    setTimeout(() => {
      document.getElementById(`place-card-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 120)
    setTimeout(() => setHighlightId(null), 2600)
  }, [])

  // ── Share ────────────────────────────────────────────────────────────────
  const shareSearch = useCallback((place?: Place) => {
    if (!coords || !submittedQuery) return
    const params = new URLSearchParams({
      q: submittedQuery,
      lat: String(coords.lat),
      lng: String(coords.lng),
      r: String(radiusKm),
    })
    if (place) params.set('place', place.id)
    const url = `${window.location.origin}/?${params.toString()}`
    const done = () => showToast('Link copied')
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(done, () => showToast('Could not copy the link'))
    } else {
      showToast('Could not copy the link')
    }
  }, [coords, submittedQuery, radiusKm, showToast])

  // ── AI query parsing (with disambiguation + near-anchor) ──────────────────
  const applyParsedSearch = useCallback((parsed: ParsedQueryResult, query: string) => {
    if (parsed.openNow) setOpenNow(true)
    setSort(mapParseSort(parsed.sort))
    if (parsed.near) void resolveNear(parsed.near)
    runSearch(query)
  }, [resolveNear, runSearch])

  const handleParse = useCallback(async (text: string) => {
    setParsing(true)
    try {
      const res = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const body = (await res.json().catch(() => null)) as ParseResponse | null
      if (body?.aiDisabled) setAiDisabled(true)
      const parsed = body?.parsed as AmbiguousParsed | null
      if (res.ok && parsed?.query) {
        const amb = parsed.ambiguous
        if (amb && Array.isArray(amb.options) && amb.options.length > 0) {
          // Ambiguous — show "Did you mean…" chips, do NOT search yet.
          setAmbiguity({
            term: amb.term || text,
            options: amb.options,
            originalText: text,
            openNow: parsed.openNow,
            sort: parsed.sort,
            near: parsed.near,
          })
        } else {
          setAmbiguity(null)
          applyParsedSearch(parsed, parsed.query)
        }
      } else {
        setAmbiguity(null)
        showToast('Could not understand that — searching as typed')
        runSearch(body?.fallbackQuery || text)
      }
    } catch {
      setAmbiguity(null)
      showToast('Could not understand that — searching as typed')
      runSearch(text)
    } finally {
      setParsing(false)
    }
  }, [applyParsedSearch, runSearch, showToast])

  const selectAmbiguity = (query: string) => {
    if (ambiguity) {
      if (ambiguity.openNow) setOpenNow(true)
      setSort(mapParseSort(ambiguity.sort))
      if (ambiguity.near) void resolveNear(ambiguity.near)
    }
    setAmbiguity(null)
    runSearch(query)
  }

  const dismissAmbiguity = () => {
    if (ambiguity) runSearch(ambiguity.originalText)
    setAmbiguity(null)
  }

  // ── Back to top ──────────────────────────────────────────────────────────
  useEffect(() => {
    const onScroll = () => setShowBackToTop(window.scrollY > 600)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const widenRadius = () => {
    const order = [1, 3, 5, 10]
    const next = order.find(r => r > radiusKm)
    if (next) setRadiusKm(next)
  }

  const errorCode = (search.error as { code?: string } | null)?.code
  const isQuota = errorCode === 'QUOTA_EXCEEDED'
  const hasSearched = submittedQuery.trim().length > 0

  return (
    <div style={{ position: 'relative', zIndex: 1 }}>
      <ScenicBackdrop />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Search */}
        <SearchBar
          value={input}
          onChange={setInput}
          onSubmit={submitSearch}
          aiDisabled={aiDisabled}
          onParse={handleParse}
          parsing={parsing}
          recentSearches={recentSearches}
          onRecentSelect={runSearch}
        />

        {/* Quick categories */}
        <CategoryChips onSelect={runSearch} activeQuery={submittedQuery} />

        {/* Disambiguation chips */}
        {ambiguity && (
          <AmbiguityChips
            term={ambiguity.term}
            options={ambiguity.options}
            onSelect={selectAmbiguity}
            onDismiss={dismissAmbiguity}
          />
        )}

        {/* Filters */}
        <FilterBar
          openNow={openNow}
          onOpenNowChange={setOpenNow}
          sort={sort}
          onSortChange={setSort}
          radiusKm={radiusKm}
          onRadiusChange={setRadiusKm}
          priceBand={priceBand}
          onPriceBandChange={setPriceBand}
        />

        {/* Location status (accuracy badge + set on map) */}
        {geoStatus !== 'denied' && (
          <div
            style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', fontSize: '0.82rem', color: 'var(--text-muted)' }}
            aria-live="polite"
          >
            <MapPin size={14} aria-hidden />
            <span>{locationLabel}</span>
            {geoStatus === 'granted' && accuracyMeters !== null && (
              <span className="chip chip-muted" title="GPS fix accuracy">±{Math.round(accuracyMeters)} m</span>
            )}
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: '2px',
                color: 'var(--accent-deep)', fontSize: '0.82rem', fontWeight: 600,
                fontFamily: "'Satoshi', sans-serif", textDecoration: 'underline',
              }}
            >
              Set on map
            </button>
            <button
              type="button"
              onClick={useMyLocation}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: '2px',
                color: 'var(--accent-deep)', fontSize: '0.82rem', fontWeight: 600,
                fontFamily: "'Satoshi', sans-serif", textDecoration: 'underline',
              }}
            >
              Use my location
            </button>
          </div>
        )}

        {/* Location picker (set on map) */}
        {pickerOpen && (
          <LocationPicker
            initialCoords={coords}
            onConfirm={handlePinConfirm}
            onCancel={() => setPickerOpen(false)}
          />
        )}

        {/* Location unavailable → city text input + quick chips + set on map */}
        {geoStatus === 'denied' && (
          <GlassCard padding="p-4" className="flex flex-col gap-3">
            <div style={{ fontSize: '0.85rem', color: 'var(--text-faint)' }}>
              {geoError || 'Location unavailable.'} Set your area:
            </div>
            <form
              onSubmit={submitCity}
              style={{ display: 'flex', gap: '8px', alignItems: 'center' }}
              aria-label="Set your city"
            >
              <input
                type="text"
                value={cityInput}
                onChange={e => setCityInput(e.target.value)}
                placeholder="Type a city…"
                aria-label="Type a city"
                enterKeyHint="search"
                style={{
                  flex: 1, minWidth: 0,
                  background: 'var(--input-bg)', border: '1px solid var(--input-border)',
                  borderRadius: '12px', color: 'var(--text-primary)',
                  padding: '12px 14px', fontSize: '0.9rem', fontFamily: "'Satoshi', sans-serif",
                }}
              />
              <Button type="submit" variant="primary" disabled={!cityInput.trim()} style={{ padding: '10px 18px' }}>
                Set
              </Button>
            </form>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }} aria-label="Quick city picks">
              {CITY_FALLBACKS.map(c => (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => pickCity(c)}
                  className="chip chip-muted"
                  style={{ cursor: 'pointer', fontFamily: "'Satoshi', sans-serif", padding: '7px 13px' }}
                >
                  {c.name}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <Button variant="ghost" onClick={() => setPickerOpen(true)}>
                <MapPin size={16} /> Set on map
              </Button>
              <Button variant="ghost" onClick={useMyLocation}>
                <LocateFixed size={16} /> Retry location
              </Button>
            </div>
          </GlassCard>
        )}
        {geoStatus === 'loading' && (
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }} aria-live="polite">
            Getting your location…
          </div>
        )}

        {/* Results header: count + anchor + compare + view toggle + demo badge */}
        {hasSearched && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <div aria-live="polite" style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                {search.isLoading ? 'Searching…' : search.data ? `${results.length} place${results.length === 1 ? '' : 's'} found` : ''}
              </div>
              {anchor && (
                <span className="chip chip-green" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }} title="Searching near this location">
                  <MapPin size={12} aria-hidden /> near {anchor.label}
                  <button
                    type="button"
                    onClick={clearAnchor}
                    aria-label="Clear location anchor"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, display: 'flex', alignItems: 'center' }}
                  >
                    <X size={13} />
                  </button>
                </span>
              )}
              {search.data?.mock && (
                <span className="chip chip-purple" title="Served from demo data instead of live SerpApi data">
                  Demo data
                </span>
              )}
              {search.data?.cached && (
                <span className="chip chip-muted" title="Served from the server cache">Cached</span>
              )}
            </div>
            <div style={{ display: 'inline-flex', gap: '6px', flexWrap: 'wrap' }}>
              <Button
                variant={compareMode ? 'primary' : 'ghost'}
                onClick={() => { setCompareMode(m => !m); setCompareIds([]) }}
                aria-pressed={compareMode}
                style={{ padding: '8px 14px' }}
              >
                Compare
              </Button>
              <div role="group" aria-label="View mode" style={{ display: 'inline-flex', gap: '6px' }}>
                <Button
                  variant={viewMode === 'list' ? 'primary' : 'ghost'}
                  onClick={() => setViewMode('list')}
                  aria-pressed={viewMode === 'list'}
                  style={{ padding: '8px 14px' }}
                >
                  <List size={15} /> List
                </Button>
                <Button
                  variant={viewMode === 'map' ? 'primary' : 'ghost'}
                  onClick={() => setViewMode('map')}
                  aria-pressed={viewMode === 'map'}
                  style={{ padding: '8px 14px' }}
                >
                  <MapIcon size={15} /> Map
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* AI answer card above results */}
        {hasSearched && (answer || answerLoading) && (
          <AnswerCard
            placeName={answer?.placeName ?? ''}
            reasons={answer?.reasons ?? []}
            summary={answer?.summary}
            loading={answerLoading && !answer}
            onOpenDetails={answerPlaceMatch ? () => setSelectedPlace(answerPlaceMatch) : undefined}
            onDismiss={() => { setAnswer(null); setAnswerLoading(false) }}
          />
        )}

        {/* Results body */}
        {search.isLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }} aria-label="Loading results">
            {[0, 1, 2, 3].map(i => <SkeletonCard key={i} />)}
          </div>
        )}

        {!search.isLoading && search.isError && (
          <ErrorState code={errorCode} message={search.error?.message} onRetry={() => search.refetch()} />
        )}

        {!search.isLoading && !search.isError && hasSearched && results.length === 0 && (
          <EmptyState onWidenRadius={radiusKm < 10 ? widenRadius : undefined} />
        )}

        {/* Compare table */}
        {!search.isLoading && !search.isError && hasSearched && viewMode === 'list' && compareMode && comparePlaces && (
          <CompareTable
            places={comparePlaces}
            userCoords={coords}
            onClose={() => setCompareMode(false)}
            onClear={clearCompare}
          />
        )}

        {!search.isLoading && !search.isError && hasSearched && results.length > 0 && viewMode === 'list' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {results.map(place => (
              <div key={place.id} id={`place-card-${place.id}`}>
                <PlaceCard
                  place={place}
                  isFavorite={isFavorite(place.id)}
                  onToggleFavorite={toggle}
                  onOpen={setSelectedPlace}
                  highlighted={highlightId === place.id}
                  userCoords={coords}
                  selectable={compareMode}
                  compareSelected={compareIds.includes(place.id)}
                  compareDisabled={compareIds.length >= 2}
                  onToggleCompare={toggleCompare}
                />
              </div>
            ))}
          </div>
        )}

        {!search.isLoading && !search.isError && hasSearched && results.length > 0 && viewMode === 'map' && (
          <MapView
            places={results}
            userLat={coords?.lat}
            userLng={coords?.lng}
            selectedId={highlightId}
            onMarkerSelect={handleMarkerSelect}
          />
        )}

        {/* Idle welcome */}
        {!hasSearched && !search.isLoading && (
          <GlassCard className="text-center" style={{ padding: '32px 24px' }}>
            <h2 style={{ fontSize: '1.3rem', marginBottom: '8px' }}>What do you need nearby?</h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', maxWidth: 420, margin: '0 auto 16px' }}>
              Type what you're looking for — or tap a category above. Results show ratings,
              hours, distance and directions from live Google Maps data.
            </p>
            <Button variant="primary" onClick={emergencySearch}>
              🚨 Open pharmacies near me
            </Button>
          </GlassCard>
        )}

        {/* Share current search */}
        {hasSearched && coords && (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Button variant="ghost" onClick={() => shareSearch()} style={{ fontSize: '0.82rem' }}>
              Share this search
            </Button>
          </div>
        )}
      </div>

      {/* Details sheet */}
      <PlaceSheet
        place={selectedPlace}
        onClose={() => setSelectedPlace(null)}
        isFavorite={selectedPlace ? isFavorite(selectedPlace.id) : false}
        onToggleFavorite={toggle}
        onShare={shareSearch}
        aiDisabled={aiDisabled}
        onAiDisabled={() => setAiDisabled(true)}
        onReviewsLoaded={handleReviewsLoaded}
        userCoords={coords}
      />

      {/* Back to top */}
      {showBackToTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="Back to top"
          style={{
            position: 'fixed', bottom: '24px', right: '24px', zIndex: 90,
            width: 48, height: 48, borderRadius: '50%',
            background: 'var(--glass-bg)',
            backdropFilter: 'blur(26px) saturate(1.6)',
            WebkitBackdropFilter: 'blur(26px) saturate(1.6)',
            border: '1px solid var(--glass-border)',
            boxShadow: 'var(--glass-shadow), inset 0 1px 0 var(--glass-highlight)',
            color: 'var(--text-primary)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <ArrowUp size={20} />
        </button>
      )}

      <Toast message={toast} />
    </div>
  )
}

export default function HomePage() {
  return (
    <Suspense fallback={
      <div style={{ position: 'relative', zIndex: 1 }}>
        <ScenicBackdrop />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  )
}
