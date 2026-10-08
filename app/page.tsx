'use client'
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { ArrowUp, List, LocateFixed, Map as MapIcon } from 'lucide-react'
import ScenicBackdrop from '../components/shared/ScenicBackdrop'
import GlassCard from '../components/shared/GlassCard'
import { useLocation } from '../components/shared/LocationContext'
import SearchBar from '../components/SearchBar'
import CategoryChips from '../components/CategoryChips'
import FilterBar from '../components/FilterBar'
import PlaceCard from '../components/PlaceCard'
import PlaceSheet from '../components/PlaceSheet'
import MapView from '../components/MapView'
import SkeletonCard from '../components/SkeletonCard'
import EmptyState from '../components/EmptyState'
import ErrorState from '../components/ErrorState'
import Toast from '../components/Toast'
import Button from '../components/ui/button'
import { useGeolocation, CITY_FALLBACKS } from '../hooks/useGeolocation'
import { useSearch } from '../hooks/useSearch'
import { useFavorites } from '../hooks/useFavorites'
import { useLocalStorage } from '../hooks/useLocalStorage'
import type { Place, ParseResponse, SortKey } from '../components/types'
import { mapParseSort, sortPlaces } from '../components/types'

function HomeContent() {
  const searchParams = useSearchParams()
  const { locationLabel, setLocationLabel, radiusKm, setRadiusKm } = useLocation()
  const { coords, status: geoStatus, error: geoError, requestLocation, setCoords } = useGeolocation()
  const { favorites, isFavorite, toggle } = useFavorites()
  // The sibling's /api/health does not carry an aiDisabled flag; the AI routes
  // report it per-call instead, so we learn it lazily and hide AI UI after.
  const [aiDisabled, setAiDisabled] = useState(false)

  const [input, setInput] = useState('')
  const [submittedQuery, setSubmittedQuery] = useState('')
  const [openNow, setOpenNow] = useState(false)
  const [sort, setSort] = useState<SortKey>('best')
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list')
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null)
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const [showBackToTop, setShowBackToTop] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [parsing, setParsing] = useState(false)
  const [pendingPlaceId, setPendingPlaceId] = useState<string | null>(null)
  const [recentSearches, setRecentSearches] = useLocalStorage<string[]>('localfinder_recent_searches', [])
  const [urlInitDone, setUrlInitDone] = useState(false)

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
      requestLocation() // browser location prompt on open (spec flow step 1)
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
    if (geoStatus === 'denied' && !coords) {
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

  // ── Results: open-now filter + client-side sort (no new API call) ─────────
  const results = useMemo(() => {
    const places = search.data?.places ?? []
    const filtered = openNow ? places.filter(p => p.isOpen === true) : places
    return sortPlaces(filtered, sort)
  }, [search.data, openNow, sort])

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

  // ── AI query parsing ─────────────────────────────────────────────────────
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
      const parsed = body?.parsed
      if (res.ok && parsed?.query) {
        if (parsed.openNow) setOpenNow(true)
        setSort(mapParseSort(parsed.sort))
        runSearch(parsed.query)
      } else {
        showToast('Could not understand that — searching as typed')
        runSearch(body?.fallbackQuery || text)
      }
    } catch {
      showToast('Could not understand that — searching as typed')
      runSearch(text)
    } finally {
      setParsing(false)
    }
  }, [runSearch, showToast])

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
          onSubmit={runSearch}
          aiDisabled={aiDisabled}
          onParse={handleParse}
          parsing={parsing}
          recentSearches={recentSearches}
          onRecentSelect={runSearch}
        />

        {/* Quick categories */}
        <CategoryChips onSelect={runSearch} activeQuery={submittedQuery} />

        {/* Filters */}
        <FilterBar
          openNow={openNow}
          onOpenNowChange={setOpenNow}
          sort={sort}
          onSortChange={setSort}
          radiusKm={radiusKm}
          onRadiusChange={setRadiusKm}
        />

        {/* Location status / city fallback */}
        {geoStatus === 'denied' && (
          <GlassCard padding="p-4" className="flex flex-col gap-3">
            <div style={{ fontSize: '0.85rem', color: 'var(--text-faint)' }}>
              {geoError || 'Location unavailable.'} Set your area:
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <select
                aria-label="Choose your city"
                value={locationLabel}
                onChange={e => {
                  const city = CITY_FALLBACKS.find(c => c.name === e.target.value)
                  if (city) {
                    setCoords({ lat: city.lat, lng: city.lng })
                    setLocationLabel(city.name)
                  }
                }}
                style={{
                  flex: 1, minWidth: 160,
                  background: 'var(--input-bg)', border: '1px solid var(--input-border)',
                  borderRadius: '12px', color: 'var(--text-primary)',
                  padding: '12px 14px', fontSize: '0.9rem', fontFamily: "'Satoshi', sans-serif",
                }}
              >
                {CITY_FALLBACKS.map(c => (
                  <option key={c.name} value={c.name}>{c.name}</option>
                ))}
              </select>
              <Button variant="ghost" onClick={requestLocation}>
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

        {/* Results header: count + view toggle + demo badge */}
        {hasSearched && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div aria-live="polite" style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                {search.isLoading ? 'Searching…' : search.data ? `${results.length} place${results.length === 1 ? '' : 's'} found` : ''}
              </div>
              {search.data?.mock && (
                <span className="chip chip-purple" title="Served from demo data instead of live SerpApi data">
                  Demo data
                </span>
              )}
              {search.data?.cached && (
                <span className="chip chip-muted" title="Served from the server cache">Cached</span>
              )}
            </div>
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
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', maxWidth: 420, margin: '0 auto' }}>
              Type what you're looking for — or tap a category above. Results show ratings,
              hours, distance and directions from live Google Maps data.
            </p>
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
