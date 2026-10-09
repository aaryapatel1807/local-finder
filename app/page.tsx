'use client'
import { FormEvent, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { ArrowUp, List, LocateFixed, Map as MapIcon, MapPin, X } from 'lucide-react'
import { motion, AnimatePresence, MotionConfig } from 'framer-motion'
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
import AnswerCard, { UnverifiedAnswerCard } from '../components/AnswerCard'
import CompareTable from '../components/CompareTable'
import ErrandPlanner from '../components/ErrandPlanner'
import MeetInMiddle from '../components/MeetInMiddle'
import LocationPicker, { PINNED_STORAGE_KEY } from '../components/LocationPicker'
import Button from '../components/ui/button'
import IntroModal from '../components/IntroModal'
import ResultNarrative from '../components/ResultNarrative'
import SuggestionChips from '../components/SuggestionChips'
import EmergencyButton from '../components/EmergencyButton'
import { GlobeHero } from '../components/GlobeHeroLazy'
import { hasSeenIntro, markIntroSeen } from '../lib/introSeen'
import { useGeolocation, CITY_FALLBACKS, type CityOption, type Coords } from '../hooks/useGeolocation'
import { useSearch } from '../hooks/useSearch'
import { useFavorites } from '../hooks/useFavorites'
import { useHealth } from '../hooks/useHealth'
import { usePersonalRank } from '../hooks/usePersonalRank'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { useLanguage } from '../hooks/useLanguage'
import type { Place, ParseResponse, ParsedQueryResult } from '../components/types'
import { mapParseSort, sortPlaces, formatDistance } from '../components/types'
import { isQuestionLike } from '../lib/question'
import { blendSentiment, hiddenGemIdSet } from '../lib/score'

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
    coords, status: geoStatus, errorKey: geoErrorKey, requestLocation, setCoords, accuracyMeters,
  } = useGeolocation()
  const { t } = useLanguage()
  const { favorites, isFavorite, toggle } = useFavorites()
  // On-device personal ranking: learns from taps/saves, zero server calls.
  const { logInteraction, rerankForYou, suggestForYou, smartDefaults } = usePersonalRank()
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
  const [recentlyViewed, setRecentlyViewed] = useLocalStorage<Place[]>('localfinder_recently_viewed', [])
  const [urlInitDone, setUrlInitDone] = useState(false)
  const [emergency, setEmergency] = useState(false)
  // Combined emergency search (pharmacy + hospital + petrol pump) results.
  const [emergencyResults, setEmergencyResults] = useState<Place[] | null>(null)
  const [emergencyLoading, setEmergencyLoading] = useState(false)
  // First-run intro modal (once per device).
  const [showIntro, setShowIntro] = useState(false)
  const health = useHealth()

  // ── Phase 2: ambiguity, anchor, answer, compare, picker ──────────────────
  const [ambiguity, setAmbiguity] = useState<AmbiguityState | null>(null)
  const [anchor, setAnchor] = useState<{ label: string } | null>(null)
  const [answer, setAnswer] = useState<AnswerState | null>(null)
  const [answerLoading, setAnswerLoading] = useState(false)
  // Quota-exhausted AI mode: general-knowledge answer, flagged unverified.
  const [unverifiedAnswer, setUnverifiedAnswer] = useState<string | null>(null)
  const [unverifiedLoading, setUnverifiedLoading] = useState(false)
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

  // ── First-run intro ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!hasSeenIntro()) setShowIntro(true)
  }, [])

  const closeIntro = useCallback(() => {
    markIntroSeen()
    setShowIntro(false)
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
      setLocationLabel(t('nav.sharedLocation'))
    } else {
      // Pinned location (set on the map earlier) wins over a fresh geo fix.
      const pin = readPinnedLocation()
      if (pin) {
        setCoords(pin)
        setLocationLabel(t('nav.pinnedLocation'))
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
    if (geoStatus === 'granted' && locationLabel !== t('nav.nearYou') && !searchParams.get('lat')) {
      setLocationLabel(t('nav.nearYou'))
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

  // Combined loading gate: query search + combined emergency search.
  const isLoading = search.isLoading || emergencyLoading

  const runSearch = useCallback((q: string) => {
    const query = q.trim()
    if (!query) return
    // If location isn't available yet (still loading/idle), fall back to
    // Vadodara so the search actually runs instead of silently disabling.
    // The location label updates so the user knows which area was searched.
    if (!coords) {
      const vadodara = CITY_FALLBACKS[0]
      setCoords({ lat: vadodara.lat, lng: vadodara.lng })
      setLocationLabel(vadodara.name)
    }
    setEmergency(false)
    setEmergencyResults(null)
    setSubmittedQuery(query)
    setInput(query)
    setViewMode('list')
    setRecentSearches(prev => [query, ...prev.filter(r => r.toLowerCase() !== query.toLowerCase())].slice(0, 5))
  }, [setRecentSearches, coords, setCoords, setLocationLabel])

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
          placeName: typeof a.place === 'string' ? a.place : (a.place?.name ?? t('page.topPick')),
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
    setUnverifiedAnswer(null)
    setUnverifiedLoading(false)
    if (isQuestionLike(t)) {
      void fetchAnswer(t)
    } else {
      setAnswer(null)
      setAnswerLoading(false)
    }
    runSearch(t)
  }, [fetchAnswer, runSearch])

  /**
   * Quota-exhausted AI mode: ask /api/answer for general-knowledge
   * guidance (flagged unverified) when live search is unavailable.
   */
  const askAiInstead = useCallback(async () => {
    if (!coords || !submittedQuery.trim() || aiDisabled) return
    setUnverifiedLoading(true)
    setUnverifiedAnswer(null)
    try {
      const res = await fetch('/api/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: submittedQuery.trim(),
          lat: coords.lat,
          lng: coords.lng,
          radiusKm,
        }),
      })
      const body = await res.json().catch(() => null)
      if (body?.aiDisabled) {
        setAiDisabled(true)
        return
      }
      const ua = body?.unverifiedAnswer
      if (ua?.unverified && typeof ua.text === 'string') {
        setUnverifiedAnswer(ua.text)
      }
    } catch {
      /* leave the error state standing */
    } finally {
      setUnverifiedLoading(false)
    }
  }, [coords, submittedQuery, radiusKm, aiDisabled])

  // ── Results: open-now + price filters + client-side sort (no new API call) ─
  const results = useMemo(() => {
    // Combined emergency results (pharmacy + hospital + petrol pump) take
    // precedence over the query search when present.
    let places = emergencyResults ?? search.data?.places ?? []
    if (openNow) places = places.filter(p => p.isOpen === true)
    if (priceBand !== 'any') places = places.filter(p => matchesPriceBand(p.price, priceBand))
    if (sort === 'foryou') {
      // Personalized on-device rerank (weights learned from taps/saves).
      // Sentiment (when known from loaded reviews) flows in as a feature.
      const enriched = places.map(p => ({
        ...p,
        sentiment: sentimentCacheRef.current.get(p.id),
      }))
      return rerankForYou(enriched, radiusKm)
    }
    if (sort === 'best') {
      const scored = places.map(p => ({
        p,
        s: blendSentiment(p.score ?? 0, sentimentCacheRef.current.get(p.id)),
      }))
      scored.sort((x, y) => y.s - x.s)
      return scored.slice(0, 20).map(x => x.p)
    }
    return sortPlaces(places, sort)
  }, [search.data, openNow, sort, priceBand, sentimentTick, radiusKm, rerankForYou, emergencyResults])

  // Sentiment from loaded review summaries feeds the best-sort blend.
  const handleReviewsLoaded = useCallback((placeId: string, sentiment?: number) => {
    if (typeof sentiment !== 'number' || !Number.isFinite(sentiment)) return
    if (sentimentCacheRef.current.get(placeId) !== sentiment) {
      sentimentCacheRef.current.set(placeId, sentiment)
      setSentimentTick(t => t + 1)
    }
  }, [])

  // ── Personal ranking: smart defaults (applied once, only when the user
  // hasn't expressed a choice yet) + interaction logging ──────────────────
  const [defaultsApplied, setDefaultsApplied] = useState(false)
  useEffect(() => {
    if (defaultsApplied) return
    let changed = false
    if (smartDefaults.radiusKm !== undefined && radiusKm !== smartDefaults.radiusKm) {
      setRadiusKm(smartDefaults.radiusKm)
      changed = true
    }
    if (smartDefaults.sort !== undefined && sort !== smartDefaults.sort) {
      setSort(smartDefaults.sort as SortKeyExt)
      changed = true
    }
    if (changed) setDefaultsApplied(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultsApplied])

  const forYouToastShown = useRef(false)
  useEffect(() => {
    if (suggestForYou && !forYouToastShown.current) {
      forYouToastShown.current = true
      showToast('Try "For you" sort — personalized to your picks')
    }
  }, [suggestForYou, showToast])

  const handleCardOpen = useCallback((place: Place | null) => {
    if (place) {
      const shownRank = results.findIndex(p => p.id === place.id)
      logInteraction('tap', place, {
        radiusKm,
        shownRank: Math.max(0, shownRank),
        shownTopPlace: results[0] ?? place,
        sort,
      })
    }
    setSelectedPlace(place)
  }, [results, radiusKm, sort, logInteraction])

  const handleToggleFavorite = useCallback((place: Place) => {
    const shownRank = results.findIndex(p => p.id === place.id)
    if (shownRank >= 0) {
      logInteraction('save', place, {
        radiusKm,
        shownRank,
        shownTopPlace: results[0] ?? place,
        sort,
      })
    }
    toggle(place)
  }, [results, radiusKm, sort, toggle, logInteraction])

  // ── Meet in the middle: a midpoint becomes the search location ───────────
  const handleMeet = useCallback((c: { lat: number; lng: number }, label: string) => {
    setCoords(c)
    setLocationLabel(label)
    showToast('Searching around ' + label)
  }, [setCoords, setLocationLabel, showToast])

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

  // ── Hidden gems: top-quartile Bayesian rating with <100 reviews ────────────
  const hiddenGemIds = useMemo(() => hiddenGemIdSet(results), [results])

  // ── Surprise me ──────────────────────────────────────────────────────────
  const openCount = useMemo(() => results.filter(p => p.isOpen === true).length, [results])
  const surpriseMe = useCallback(() => {
    const open = results.filter(p => p.isOpen === true)
    if (open.length === 0) return
    setSelectedPlace(open[Math.floor(Math.random() * open.length)])
  }, [results])

  // ── Compare (up to 3) ────────────────────────────────────────────────────
  const toggleCompare = useCallback((place: Place) => {
    setCompareIds(prev => {
      if (prev.includes(place.id)) return prev.filter(id => id !== place.id)
      if (prev.length >= 3) {
        showToast(t('toast.compareMax'))
        return prev
      }
      return [...prev, place.id]
    })
  }, [showToast, t])

  const comparePlaces = useMemo(() => {
    if (compareIds.length < 2) return null
    const found = compareIds
      .map(id => results.find(p => p.id === id))
      .filter((p): p is Place => !!p)
    return found.length >= 2 ? found : null
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
          setLocationLabel(t('page.nearAnchor', { label }))
          setAnchor({ label })
          showToast(t('page.searchingAround', { label }))
          return
        }
      }
      // 404 NO_RESULTS or bad payload → keep current location
      showToast(t('toast.geocodeFail', { q }))
    } catch {
      showToast(t('toast.geocodeFail', { q }))
    }
  }, [setCoords, setLocationLabel, showToast, t])

  const clearAnchor = useCallback(() => {
    setAnchor(null)
    setLocationLabel(t('nav.nearYou'))
    requestLocation()
  }, [requestLocation, setLocationLabel, t])

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
          showToast(t('toast.showingResultsFor', { label: typeof g.label === 'string' && g.label ? g.label : q }))
          return
        }
      }
      showToast(t('toast.cityNotFound', { q }))
    } catch {
      showToast(t('toast.cityLookupFail'))
    }
  }, [cityInput, setCoords, setLocationLabel, showToast, t])

  const pickCity = useCallback((city: CityOption) => {
    setCoords({ lat: city.lat, lng: city.lng })
    setLocationLabel(city.name)
    setAnchor(null)
  }, [setCoords, setLocationLabel])

  // ── Pinned location (set on the map) ─────────────────────────────────────
  const handlePinConfirm = useCallback((c: Coords) => {
    setCoords(c)
    setLocationLabel(t('nav.pinnedLocation'))
    setAnchor(null)
    setPickerOpen(false)
    showToast(t('toast.pinnedSet'))
  }, [setCoords, setLocationLabel, showToast, t])

  // ── Combined emergency search: 24h pharmacies + hospitals + petrol pumps ───
  // Explicit user tap (EmergencyButton). Up to 3 cached /api/search calls,
  // merged + deduped into one open-now, nearest-first list.
  const runEmergencySearch = useCallback(async () => {
    if (!coords) {
      showToast(t('errand.needLocation'))
      return
    }
    setEmergency(true)
    setOpenNow(true)
    setSort('nearest')
    setEmergencyLoading(true)
    setEmergencyResults(null)
    setViewMode('list')
    try {
      const bodies = await Promise.all(
        ['24 hour pharmacy', 'hospital', 'petrol pump'].map(async (query) => {
          const res = await fetch('/api/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, lat: coords.lat, lng: coords.lng, radiusKm }),
          })
          const body = await res.json().catch(() => null)
          return (res.ok && Array.isArray(body?.places) ? body.places : []) as Place[]
        })
      )
      const merged: Place[] = []
      const seen = new Set<string>()
      for (const list of bodies) {
        for (const p of list) {
          if (!seen.has(p.id)) {
            seen.add(p.id)
            merged.push(p)
          }
        }
      }
      const open = merged
        .filter(p => p.isOpen === true)
        .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity))
        .slice(0, 20)
      setEmergencyResults(open)
      if (open.length === 0) showToast(t('page.noOpenPlaces'))
    } catch {
      showToast(t('page.noOpenPlaces'))
    } finally {
      setEmergencyLoading(false)
    }
  }, [coords, radiusKm, showToast, t])

  // ── Recently viewed ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedPlace) return
    setRecentlyViewed(prev =>
      [selectedPlace, ...prev.filter(p => p.id !== selectedPlace.id)].slice(0, 6)
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlace])

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
    const done = () => showToast(t('toast.linkCopied'))
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(done, () => showToast(t('toast.copyFailed')))
    } else {
      showToast(t('toast.copyFailed'))
    }
  }, [coords, submittedQuery, radiusKm, showToast, t])

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
        showToast(t('toast.aiFallback'))
        runSearch(body?.fallbackQuery || text)
      }
    } catch {
      setAmbiguity(null)
      showToast(t('toast.aiFallback'))
      runSearch(text)
    } finally {
      setParsing(false)
    }
  }, [applyParsedSearch, runSearch, showToast, t])

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
  const hasSearched = submittedQuery.trim().length > 0 || emergencyResults !== null

  return (
    <MotionConfig reducedMotion="user">
      <div style={{ position: 'relative', zIndex: 1 }}>
        <ScenicBackdrop />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', isolation: 'isolate' }}>
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

        {/* Errand planner + meet in the middle */}
        <div id="errands" style={{ scrollMarginTop: '90px' }}>
          <ErrandPlanner coords={coords} />
        </div>
        <div id="meet" style={{ scrollMarginTop: '90px' }}>
          <MeetInMiddle myCoords={coords} onMeet={handleMeet} />
        </div>

        {/* Location status (accuracy badge + set on map) */}
        {geoStatus !== 'denied' && (
          <div
            style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', fontSize: '0.82rem', color: 'var(--text-muted)' }}
            aria-live="polite"
          >
            <MapPin size={14} aria-hidden />
            <span>{locationLabel}</span>
            {geoStatus === 'granted' && accuracyMeters !== null && (
              <span className="chip chip-muted" title={t('page.gpsAccuracy')}>±{Math.round(accuracyMeters)} m</span>
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
              {t('page.setOnMap')}
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
              {t('page.useMyLocation')}
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
              {geoErrorKey ? t(geoErrorKey) : t('page.locationUnavailable')} {t('page.geoAreaPrompt')}
            </div>
            <form
              onSubmit={submitCity}
              style={{ display: 'flex', gap: '8px', alignItems: 'center' }}
              aria-label={t('page.chooseCity')}
            >
              <input
                type="text"
                value={cityInput}
                onChange={e => setCityInput(e.target.value)}
                placeholder={t('page.cityPlaceholder')}
                aria-label={t('page.cityPlaceholder')}
                enterKeyHint="search"
                style={{
                  flex: 1, minWidth: 0,
                  background: 'var(--input-bg)', border: '1px solid var(--input-border)',
                  borderRadius: '12px', color: 'var(--text-primary)',
                  padding: '12px 14px', fontSize: '0.9rem', fontFamily: "'Satoshi', sans-serif",
                }}
              />
              <Button type="submit" variant="primary" disabled={!cityInput.trim()} style={{ padding: '10px 18px' }}>
                {t('page.setCity')}
              </Button>
            </form>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }} aria-label={t('page.quickCityPicks')}>
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
                <MapPin size={16} /> {t('page.setOnMap')}
              </Button>
              <Button variant="ghost" onClick={useMyLocation}>
                <LocateFixed size={16} /> {t('page.retryLocation')}
              </Button>
            </div>
          </GlassCard>
        )}
        {geoStatus === 'loading' && (
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }} aria-live="polite">
            {t('page.locating')}
          </div>
        )}

        {/* Results header: count + anchor + compare + view toggle + demo badge */}
        {hasSearched && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <div aria-live="polite" style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                {isLoading ? t('page.searching') : (search.data || emergencyResults) ? (results.length === 1 ? t('page.resultsOne') : t('page.resultsMany', { count: results.length })) : ''}
              </div>
              {anchor && (
                <span className="chip chip-green" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }} title={t('page.anchorTitle')}>
                  <MapPin size={12} aria-hidden /> {t('page.nearAnchor', { label: anchor.label })}
                  <button
                    type="button"
                    onClick={clearAnchor}
                    aria-label={t('page.clearAnchor')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, display: 'flex', alignItems: 'center' }}
                  >
                    <X size={13} />
                  </button>
                </span>
              )}
              {search.data?.mock && (
                <span className="chip chip-purple" title={t('page.demoDataTitle')}>
                  {t('page.demoData')}
                </span>
              )}
              {search.data?.cached && (
                <span className="chip chip-muted" title={t('page.cachedTitle')}>{t('page.cached')}</span>
              )}
            </div>
            <div style={{ display: 'inline-flex', gap: '6px', flexWrap: 'wrap' }}>
              <Button
                variant="ghost"
                onClick={surpriseMe}
                disabled={openCount === 0}
                title={t(openCount === 0 ? 'page.noOpenPlaces' : 'page.randomOpenPlace')}
                style={{ padding: '8px 14px' }}
              >
                {t('page.surpriseMe')}
              </Button>
              <Button
                variant={compareMode ? 'primary' : 'ghost'}
                onClick={() => { setCompareMode(m => !m); setCompareIds([]) }}
                aria-pressed={compareMode}
                style={{ padding: '8px 14px' }}
              >
                {compareIds.length > 0 ? t('page.compareWithCount', { count: compareIds.length }) : t('page.compare')}
              </Button>
              <div role="group" aria-label={t('page.viewMode')} style={{ display: 'inline-flex', gap: '6px' }}>
                <Button
                  variant={viewMode === 'list' ? 'primary' : 'ghost'}
                  onClick={() => setViewMode('list')}
                  aria-pressed={viewMode === 'list'}
                  style={{ padding: '8px 14px' }}
                >
                  <List size={15} /> {t('page.list')}
                </Button>
                <Button
                  variant={viewMode === 'map' ? 'primary' : 'ghost'}
                  onClick={() => setViewMode('map')}
                  aria-pressed={viewMode === 'map'}
                  style={{ padding: '8px 14px' }}
                >
                  <MapIcon size={15} /> {t('page.map')}
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
        {isLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }} aria-label={t('page.loadingResults')}>
            {[0, 1, 2, 3].map(i => <SkeletonCard key={i} />)}
          </div>
        )}

        {!isLoading && search.isError && (
          <ErrorState
            code={errorCode}
            message={search.error?.message}
            onRetry={() => search.refetch()}
            onAskAi={askAiInstead}
            aiLoading={unverifiedLoading}
          />
        )}

        {/* Quota-exhausted AI answer (flagged unverified — never a listing) */}
        {hasSearched && (unverifiedAnswer || unverifiedLoading) && (
          <UnverifiedAnswerCard
            text={unverifiedAnswer ?? ''}
            loading={unverifiedLoading && !unverifiedAnswer}
            onDismiss={() => { setUnverifiedAnswer(null); setUnverifiedLoading(false) }}
          />
        )}

        {!isLoading && !search.isError && hasSearched && results.length === 0 && (
          <EmptyState onWidenRadius={radiusKm < 10 ? widenRadius : undefined} />
        )}

        {/* Compare table */}
        {!isLoading && !search.isError && hasSearched && viewMode === 'list' && compareMode && comparePlaces && (
          <CompareTable
            places={comparePlaces}
            userCoords={coords}
            onClose={() => setCompareMode(false)}
            onClear={clearCompare}
          />
        )}

        {/* One-line story above the results */}
        {hasSearched && !isLoading && !search.isError && results.length > 0 && (
          <ResultNarrative
            count={results.length}
            openCount={openCount}
            radiusKm={radiusKm}
            nearestName={results[0]?.name}
            nearestWalkMin={results[0]?.distanceKm !== undefined ? Math.max(1, Math.round(results[0].distanceKm / 5 * 60)) : undefined}
          />
        )}

        {!isLoading && !search.isError && hasSearched && results.length > 0 && viewMode === 'list' && (
          <motion.div
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
            initial="hidden"
            animate="show"
            style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
          >
            {results.map(place => (
              <motion.div
                key={place.id}
                id={`place-card-${place.id}`}
                variants={{
                  hidden: { opacity: 0, y: 12 },
                  show: { opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' } },
                }}
              >
                <PlaceCard
                  place={place}
                  isFavorite={isFavorite(place.id)}
                  onToggleFavorite={handleToggleFavorite}
                  onOpen={handleCardOpen}
                  highlighted={highlightId === place.id}
                  userCoords={coords}
                  selectable={compareMode}
                  compareSelected={compareIds.includes(place.id)}
                  compareDisabled={compareIds.length >= 3}
                  onToggleCompare={toggleCompare}
                  emergency={emergency}
                  hiddenGem={hiddenGemIds.has(place.id)}
                />
              </motion.div>
            ))}
          </motion.div>
        )}

        {!isLoading && !search.isError && hasSearched && results.length > 0 && viewMode === 'map' && (
          <MapView
            places={results}
            userLat={coords?.lat}
            userLng={coords?.lng}
            selectedId={highlightId}
            onMarkerSelect={handleMarkerSelect}
          />
        )}

        {/* Idle welcome */}
        {!hasSearched && !isLoading && (
          <GlassCard className="text-center" style={{ padding: '32px 24px' }}>
            <GlobeHero />
            <h2 style={{ fontSize: '1.3rem', marginBottom: '8px' }}>{t('page.welcomeTitle')}</h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', maxWidth: 420, margin: '0 auto 16px' }}>
              {t('page.welcomeBody')}
            </p>
            <div style={{ marginBottom: '16px' }}>
              <SuggestionChips onSelect={runSearch} />
            </div>
            <EmergencyButton onActivate={runEmergencySearch} />
          </GlassCard>
        )}

        {/* Recently viewed */}
        {!hasSearched && !isLoading && recentlyViewed.length > 0 && (
          <div id="recent" style={{ scrollMarginTop: '90px' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '8px' }}>{t('page.recentlyViewed')}</h3>
            <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px' }}>
              {recentlyViewed.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedPlace(p)}
                  aria-label={t('page.viewPlace', { name: p.name })}
                  style={{
                    flexShrink: 0, width: 150, textAlign: 'left', cursor: 'pointer',
                    background: 'var(--glass-bg)',
                    backdropFilter: 'blur(26px) saturate(1.6)',
                    WebkitBackdropFilter: 'blur(26px) saturate(1.6)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: '18px', padding: '10px',
                    boxShadow: 'var(--glass-shadow)',
                    fontFamily: "'Satoshi', sans-serif",
                  }}
                >
                  {p.thumbnail ? (
                    <img
                      src={p.thumbnail}
                      alt=""
                      loading="lazy"
                      style={{ width: '100%', height: 72, borderRadius: '12px', objectFit: 'cover', marginBottom: '6px', display: 'block' }}
                    />
                  ) : (
                    <div
                      aria-hidden
                      style={{
                        width: '100%', height: 72, borderRadius: '12px', marginBottom: '6px',
                        background: 'linear-gradient(135deg, rgba(21,178,207,0.25), rgba(123,97,255,0.25))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'var(--text-muted)', fontSize: '1.2rem', fontWeight: 700,
                      }}
                    >
                      {p.name.charAt(0)}
                    </div>
                  )}
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.name}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {p.rating !== undefined && p.rating !== null ? `★ ${p.rating.toFixed(1)}` : t('badges.noRating')}
                    {p.distanceKm !== undefined && ` · ${formatDistance(p.distanceKm)}`}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Share current search */}
        {hasSearched && coords && (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Button variant="ghost" onClick={() => shareSearch()} style={{ fontSize: '0.82rem' }}>
              {t('page.shareSearch')}
            </Button>
          </div>
        )}

        {/* Quota meter */}
        {health?.callsThisMonth !== undefined && (
          <div style={{ textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-faint)' }} aria-live="polite">
            {t('page.quotaMeter', { count: health.callsThisMonth })}
          </div>
        )}
      </div>

      {/* Details sheet */}
      <AnimatePresence>
        {selectedPlace && (
          <PlaceSheet
            place={selectedPlace}
            onClose={() => setSelectedPlace(null)}
            isFavorite={isFavorite(selectedPlace.id)}
            onToggleFavorite={handleToggleFavorite}
            onShare={shareSearch}
            aiDisabled={aiDisabled}
            onAiDisabled={() => setAiDisabled(true)}
            onReviewsLoaded={handleReviewsLoaded}
            userCoords={coords}
            emergency={emergency}
          />
        )}
      </AnimatePresence>

      {/* First-run intro */}
      <IntroModal open={showIntro} onClose={closeIntro} />

      {/* Back to top */}
      {showBackToTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label={t('page.backToTop')}
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
    </MotionConfig>
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
