import { useEffect, useState, useCallback } from 'react'
import type { Place } from '../components/types'

const KEY = 'localfinder_favorites'

function readLocal(): Place[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/**
 * Favorites with localStorage as the primary store. Best-effort sync to
 * /api/favorites (GET with `?localOnly=1` so the server can stay local-only;
 * POST/DELETE fire-and-forget). Works fully offline/local without the API.
 */
export function useFavorites() {
  const [favorites, setFavorites] = useState<Place[]>(() =>
    typeof window === 'undefined' ? [] : readLocal()
  )

  // Hydrate from the server on mount when it responds (optional backend).
  useEffect(() => {
    let cancelled = false
    fetch('/api/favorites?localOnly=1', { headers: { Accept: 'application/json' } })
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (cancelled || !data) return
        const serverPlaces: Place[] = Array.isArray(data) ? data : data.favorites
        if (!Array.isArray(serverPlaces)) return
        setFavorites(prev => {
          const merged = new Map(prev.map(p => [p.id, p]))
          for (const p of serverPlaces) if (p && p.id && !merged.has(p.id)) merged.set(p.id, p)
          const next = Array.from(merged.values())
          try { localStorage.setItem(KEY, JSON.stringify(next)) } catch {}
          return next
        })
      })
      .catch(() => {}) // server optional — local state stays authoritative
    return () => { cancelled = true }
  }, [])

  const persist = useCallback((next: Place[]) => {
    setFavorites(next)
    try { localStorage.setItem(KEY, JSON.stringify(next)) } catch {}
  }, [])

  const isFavorite = useCallback((id: string) => favorites.some(p => p.id === id), [favorites])

  const toggle = useCallback((place: Place) => {
    setFavorites(prev => {
      const exists = prev.some(p => p.id === place.id)
      const next = exists ? prev.filter(p => p.id !== place.id) : [...prev, place]
      try { localStorage.setItem(KEY, JSON.stringify(next)) } catch {}
      // Best-effort server sync — never blocks the UI.
      if (exists) {
        fetch(`/api/favorites?id=${encodeURIComponent(place.id)}`, { method: 'DELETE' }).catch(() => {})
      } else {
        fetch('/api/favorites?localOnly=1', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ place }),
        }).catch(() => {})
      }
      return next
    })
  }, [])

  const remove = useCallback((id: string) => {
    setFavorites(prev => {
      const next = prev.filter(p => p.id !== id)
      try { localStorage.setItem(KEY, JSON.stringify(next)) } catch {}
      fetch(`/api/favorites?id=${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {})
      return next
    })
  }, [])

  return { favorites, isFavorite, toggle, remove, persist }
}
