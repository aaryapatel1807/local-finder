import { useQuery } from '@tanstack/react-query'
import type { SearchResponse, SearchError } from '../components/types'

export interface SearchParams {
  query: string
  lat: number
  lng: number
  radiusKm: number
}

const round3 = (n: number) => Math.round(n * 1000) / 1000

/**
 * TanStack Query wrapper for POST /api/search.
 * Keyed [query, lat3, lng3, radiusKm] (spec 7.2 — coords rounded to 3 decimals).
 * Enabled ONLY on explicit submit (no keystroke searching).
 */
export function useSearch(params: SearchParams) {
  const q = params.query.trim()
  const enabled = q.length > 0 && Number.isFinite(params.lat) && Number.isFinite(params.lng)

  return useQuery<SearchResponse, Error & SearchError>({
    queryKey: ['search', q.toLowerCase(), round3(params.lat), round3(params.lng), params.radiusKm],
    queryFn: async () => {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, lat: params.lat, lng: params.lng, radiusKm: params.radiusKm }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        const err = new Error(body?.message || 'Search failed. Please try again.') as Error & SearchError
        err.code = body?.code
        err.status = res.status
        throw err
      }
      return body as SearchResponse
    },
    enabled,
  })
}
