/** Normalized place shape — mirrors spec 7.4 (sibling's lib/normalize.ts is
 *  the source of truth if shapes differ slightly; not present yet at write time). */
export interface Place {
  id: string
  dataId?: string
  name: string
  category?: string
  rating?: number
  reviews?: number
  price?: string
  address?: string
  phone?: string
  website?: string
  openLabel?: string
  isOpen: boolean | null
  closesSoon: boolean
  /** Minutes until closing when open and the closing time is known. */
  minutesToClose?: number
  hoursToday?: string
  weeklyHours?: Record<string, string>
  lat: number
  lng: number
  distanceKm?: number
  thumbnail?: string
  score?: number
}

export interface SearchResponse {
  cached: boolean
  count: number
  places: Place[]
  /** Present when the API served mock/demo data instead of live SerpApi data. */
  mock?: boolean
}

export interface SearchError {
  code?: string
  message?: string
  status?: number
}

/** POST /api/parse result (spec 8.4; sibling's route returns a nested `parsed`). */
export interface ParsedQueryResult {
  query: string
  openNow?: boolean
  priceMax?: number
  near?: string
  sort?: 'best' | 'nearest' | 'rating' | 'reviews'
  /** Set only when the AI parser finds the term genuinely ambiguous. */
  ambiguous?: {
    term: string
    options: { label: string; query: string }[]
  }
  /** 'hi' = Hindi, 'gu' = Gujarati (script or transliterated); omitted for English. */
  detectedLang?: 'hi' | 'gu' | 'en'
}

export interface ParseResponse {
  parsed: ParsedQueryResult | null
  cached?: boolean
  aiDisabled?: boolean
  fallbackQuery?: string
}

/** Map the server's sort enum onto the client's SortKey. */
export function mapParseSort(s?: ParsedQueryResult['sort']): SortKey {
  if (s === 'nearest') return 'nearest'
  if (s === 'rating') return 'rated'
  if (s === 'reviews') return 'reviewed'
  return 'best'
}

/** POST /api/reviews result (spec 8.3). null summary hides the AI section. */
export interface ReviewSummary {
  summary: string | null
  pros?: string[]
  cons?: string[]
  basedOn?: number
  aiDisabled?: boolean
  /** From the same summarize call (phase 2): fixed-allowlist tags. */
  tags?: string[]
  /** From the same summarize call (phase 2): -1 (negative) .. 1 (positive). */
  sentiment?: number
  /** From the same summarize call: busy/quiet hint, only when reviews support it. */
  bestTimeHint?: string
}

export type SortKey = 'best' | 'nearest' | 'rated' | 'reviewed' | 'foryou'

/** Client-side sort of fetched places — no new API call (spec 6.4). Cap 20. */
export function sortPlaces(places: Place[], sort: SortKey): Place[] {
  const arr = [...places]
  switch (sort) {
    case 'nearest':
      arr.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity))
      break
    case 'rated':
      arr.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1))
      break
    case 'reviewed':
      arr.sort((a, b) => (b.reviews ?? -1) - (a.reviews ?? -1))
      break
    case 'foryou':
      // The true personalized rerank is applied client-side by a hook;
      // until then, fall back to the server 'best' order as the baseline.
      arr.sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
      break
    case 'best':
    default:
      arr.sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
      break
  }
  return arr.slice(0, 20)
}

export function formatDistance(km?: number): string {
  if (km === undefined || km === null || Number.isNaN(km)) return ''
  if (km < 1) return `${Math.round(km * 1000)} m`
  return `${km.toFixed(1)} km`
}
