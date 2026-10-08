import { useCallback, useState } from 'react'

export type GeoStatus = 'idle' | 'loading' | 'granted' | 'denied'

export interface Coords {
  lat: number
  lng: number
}

export interface CityOption extends Coords {
  name: string
}

/** City text-box fallback — no API needed, per spec 2.1. */
export const CITY_FALLBACKS: CityOption[] = [
  { name: 'Vadodara', lat: 22.3072, lng: 73.1812 },
  { name: 'Ahmedabad', lat: 23.0225, lng: 72.5714 },
  { name: 'Mumbai', lat: 19.076, lng: 72.8777 },
  { name: 'Delhi', lat: 28.6139, lng: 77.209 },
  { name: 'Surat', lat: 21.1702, lng: 72.8311 },
]

export function useGeolocation() {
  const [coords, setCoords] = useState<Coords | null>(null)
  const [status, setStatus] = useState<GeoStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  const requestLocation = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatus('denied')
      setError('Geolocation is not supported in this browser.')
      return
    }
    setStatus('loading')
    setError(null)
    navigator.geolocation.getCurrentPosition(
      pos => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setStatus('granted')
      },
      err => {
        setStatus('denied')
        setError(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission denied. Pick a city below instead.'
            : 'Could not get your location. Pick a city below instead.'
        )
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    )
  }, [])

  return { coords, status, error, requestLocation, setCoords }
}
