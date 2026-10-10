import { useCallback, useEffect, useRef, useState } from 'react'

export type GeoStatus = 'idle' | 'loading' | 'granted' | 'denied'

/** Machine-readable geolocation failure keys — each resolves to a
 *  dictionary entry (geo.denied / geo.unavailable / geo.unsupported)
 *  when rendered through t(). */
export type GeoErrorKey = 'geo.denied' | 'geo.unavailable' | 'geo.unsupported'

export interface Coords {
  lat: number
  lng: number
}

export interface CityOption extends Coords {
  name: string
}

/** City quick chips — no API needed, per spec 2.1. */
export const CITY_FALLBACKS: CityOption[] = [
  { name: 'Vadodara', lat: 22.3072, lng: 73.1812 },
  { name: 'Ahmedabad', lat: 23.0225, lng: 72.5714 },
  { name: 'Mumbai', lat: 19.076, lng: 72.8777 },
  { name: 'Delhi', lat: 28.6139, lng: 77.209 },
  { name: 'Surat', lat: 21.1702, lng: 72.8311 },
]

/** Watch-position refinement window (ms) — collect fixes, keep the most accurate. */
export const GEO_REFINEMENT_MS = 15000

/** Fixes worse than this accuracy (m) are treated as unreliable. */
export const GEO_MAX_ACCEPTABLE_ACCURACY_M = 1000

/** Target accuracy (m) — stop refining early once we hit this. */
export const GEO_TARGET_ACCURACY_M = 100

/**
 * Browser geolocation with watchPosition refinement: collects fixes for up
 * to GEO_REFINEMENT_MS with enableHighAccuracy, keeps the fix with the
 * lowest coords.accuracy, and exposes it as accuracyMeters. Stops watching
 * on lock/timeout. Return shape stays {coords, status, error, errorKey,
 * requestLocation, setCoords} compatible.
 */
export function useGeolocation() {
  const [coords, setCoords] = useState<Coords | null>(null)
  const [status, setStatus] = useState<GeoStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [errorKey, setErrorKey] = useState<GeoErrorKey | null>(null)
  const [accuracyMeters, setAccuracyMeters] = useState<number | null>(null)
  const watchRef = useRef<number | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const stopWatching = useCallback(() => {
    if (watchRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchRef.current)
      watchRef.current = null
    }
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  // Clean up any in-flight watch on unmount.
  useEffect(() => () => stopWatching(), [stopWatching])

  const requestLocation = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatus('denied')
      setError('Geolocation is not supported in this browser.')
      setErrorKey('geo.unsupported')
      return
    }
    stopWatching()
    setStatus('loading')
    setError(null)
    setErrorKey(null)
    setAccuracyMeters(null)

    let best: { lat: number; lng: number; accuracy: number } | null = null

    const finish = () => {
      stopWatching()
      if (best && best.accuracy <= GEO_MAX_ACCEPTABLE_ACCURACY_M) {
        setCoords({ lat: best.lat, lng: best.lng })
        setAccuracyMeters(best.accuracy)
        setStatus('granted')
      } else if (best) {
        // We got a fix but it's too coarse to trust (e.g. ±15 km network
        // fix). Tell the user instead of silently poisoning results.
        setStatus('denied')
        setError(
          `Location is too imprecise (±${Math.round(best.accuracy / 1000)} km). ` +
          'Try moving outdoors, or set your location on the map.'
        )
        setErrorKey('geo.unavailable')
      } else {
        setStatus('denied')
        setError('Could not get your location. Type a city below or set it on the map.')
        setErrorKey('geo.unavailable')
      }
    }

    watchRef.current = navigator.geolocation.watchPosition(
      pos => {
        const accuracy = pos.coords.accuracy ?? Infinity
        // Keep the most accurate fix seen so far.
        if (!best || accuracy < best.accuracy) {
          best = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: Number.isFinite(accuracy) ? Math.round(accuracy) : accuracy,
          }
          // Only push to UI when the fix is usable — a 15km-accurate
          // network fix is worse than no fix (it silently poisons results).
          if (accuracy <= GEO_MAX_ACCEPTABLE_ACCURACY_M) {
            setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
            setAccuracyMeters(Number.isFinite(accuracy) ? Math.round(accuracy) : null)
          }
        }
        // Stop early once we have a good fix — no need to wait the full window.
        if (best && best.accuracy <= GEO_TARGET_ACCURACY_M) {
          finish()
        }
      },
      err => {
        // On hard error with no fix at all, fail fast; otherwise keep
        // collecting until the refinement window ends.
        if (!best && err.code === err.PERMISSION_DENIED) {
          stopWatching()
          setStatus('denied')
          setError('Location permission denied. Type a city below or set it on the map.')
          setErrorKey('geo.denied')
        }
      },
      { enableHighAccuracy: true, timeout: GEO_REFINEMENT_MS, maximumAge: 0 }
    )
    timerRef.current = setTimeout(finish, GEO_REFINEMENT_MS)
  }, [stopWatching])

  return { coords, status, error, errorKey, requestLocation, setCoords, accuracyMeters }
}
