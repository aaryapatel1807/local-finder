import { useEffect, useMemo, useState } from 'react'
import type { Place } from '../components/types'

export type RouteMode = 'walk' | 'drive'

export interface RouteInfo {
  durationMin: number
  distanceKm: number
  /** True when the server fell back to an estimate (OSRM unavailable). */
  estimated?: boolean
}

/** 24h in-memory cache, shared across hook instances (module scope). */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const cache = new Map<string, { value: RouteInfo | null; at: number }>()
const inFlight = new Map<string, Promise<RouteInfo | null>>()

const cacheKey = (placeId: string, mode: RouteMode) => `${mode}:${placeId}`

async function fetchRoute(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  mode: RouteMode
): Promise<RouteInfo | null> {
  try {
    const res = await fetch(
      `/api/route?from=${from.lat},${from.lng}&to=${to.lat},${to.lng}&mode=${mode}`
    )
    if (!res.ok) return null // non-200 (400/429) → treat as unknown; OSRM failures now return 200 with estimated: true
    const body = await res.json().catch(() => null)
    if (typeof body?.durationMin !== 'number') return null
    return {
      durationMin: body.durationMin,
      distanceKm: typeof body.distanceKm === 'number' ? body.distanceKm : 0,
      estimated: body.estimated === true,
    }
  } catch {
    return null
  }
}

/**
 * Lazily resolves /api/route travel times for a set of places.
 *
 * - Never blocks render: returns the Map of resolved entries; it fills in
 *   as requests complete.
 * - In-flight requests are deduped (shared module scope) and results are
 *   cached in-memory for 24h keyed by place + mode.
 * - Places without a resolved route map to null (RouteBadge hides).
 */
export function useRouteTime(
  userCoords: { lat: number; lng: number } | null | undefined,
  places: Place[],
  mode: RouteMode = 'walk'
): Map<string, RouteInfo | null> {
  const [routes, setRoutes] = useState<Map<string, RouteInfo | null>>(new Map())
  const placeSig = useMemo(() => places.map(p => p.id).join('|'), [places])
  const lat = userCoords?.lat
  const lng = userCoords?.lng

  useEffect(() => {
    if (lat === undefined || lng === undefined) {
      setRoutes(new Map())
      return
    }
    const now = Date.now()
    // Seed this render's Map from the shared cache.
    setRoutes(prev => {
      const next = new Map<string, RouteInfo | null>()
      for (const p of places) {
        const hit = cache.get(cacheKey(p.id, mode))
        if (hit && now - hit.at < CACHE_TTL_MS) next.set(p.id, hit.value)
        else if (prev.has(p.id)) next.set(p.id, prev.get(p.id) ?? null)
      }
      return next
    })

    let cancelled = false
    for (const p of places) {
      const key = cacheKey(p.id, mode)
      const hit = cache.get(key)
      if (hit && now - hit.at < CACHE_TTL_MS) continue
      if (inFlight.has(key)) {
        // Attach to the in-flight request so this instance updates too.
        inFlight.get(key)!.then(v => {
          if (!cancelled) setRoutes(prev => new Map(prev).set(p.id, v))
        })
        continue
      }
      const promise = fetchRoute({ lat, lng }, { lat: p.lat, lng: p.lng }, mode)
      inFlight.set(key, promise)
      promise.then(v => {
        inFlight.delete(key)
        cache.set(key, { value: v, at: Date.now() })
        if (!cancelled) setRoutes(prev => new Map(prev).set(p.id, v))
      })
    }
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng, mode, placeSig])

  return routes
}
