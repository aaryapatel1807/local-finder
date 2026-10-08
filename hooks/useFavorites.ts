import { useEffect, useState, useCallback, useMemo } from 'react'
import type { Place } from '../components/types'

const KEY = 'localfinder_favorites'

/** Default list — always exists, holds the legacy favorites. */
export const DEFAULT_LIST_ID = 'saved'
export const DEFAULT_LIST_NAME = 'Saved'

export interface SavedList {
  id: string
  name: string
  placeIds: string[]
  notes: Record<string, string>
}

interface ListsStore {
  version: 1
  lists: SavedList[]
  places: Record<string, Place>
}

const defaultList = (placeIds: string[] = []): SavedList => ({
  id: DEFAULT_LIST_ID,
  name: DEFAULT_LIST_NAME,
  placeIds,
  notes: {},
})

function isListsStore(v: unknown): v is ListsStore {
  if (typeof v !== 'object' || v === null) return false
  const s = v as Partial<ListsStore>
  return s.version === 1 && Array.isArray(s.lists) && typeof s.places === 'object' && s.places !== null
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `list-${Date.now()}-${Math.floor(Math.random() * 1e9)}`
}

/** Read the store, migrating the legacy Place[] shape into the default list. */
function readStore(): ListsStore {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { version: 1, lists: [defaultList()], places: {} }
    const parsed: unknown = JSON.parse(raw)
    if (isListsStore(parsed)) {
      // Guarantee the default list exists (forward-compat).
      if (!parsed.lists.some(l => l.id === DEFAULT_LIST_ID)) {
        parsed.lists = [defaultList(), ...parsed.lists]
      }
      return parsed
    }
    if (Array.isArray(parsed)) {
      // Legacy shape: plain Place[] favorites.
      const places: Record<string, Place> = {}
      const placeIds: string[] = []
      for (const p of parsed as Place[]) {
        if (p && typeof p.id === 'string') {
          places[p.id] = p
          placeIds.push(p.id)
        }
      }
      return { version: 1, lists: [defaultList(placeIds)], places }
    }
    return { version: 1, lists: [defaultList()], places: {} }
  } catch {
    return { version: 1, lists: [defaultList()], places: {} }
  }
}

function writeStore(store: ListsStore): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(store))
  } catch {}
}

/**
 * Favorites with localStorage as the primary store, extended with named
 * lists. The legacy favorites are the "Saved" default list; the stored
 * shape migrates automatically from a plain Place[] on first load.
 *
 * Best-effort sync to /api/favorites (GET with `?localOnly=1` so the server
 * can stay local-only; POST/DELETE fire-and-forget). Works fully
 * offline/local without the API.
 */
export function useFavorites() {
  const [store, setStore] = useState<ListsStore>(() =>
    typeof window === 'undefined'
      ? { version: 1, lists: [defaultList()], places: {} }
      : readStore()
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
        const valid = serverPlaces.filter(p => p && typeof p.id === 'string')
        if (valid.length === 0) return
        setStore(prev => {
          const places = { ...prev.places }
          const ids = new Set(
            prev.lists.find(l => l.id === DEFAULT_LIST_ID)?.placeIds ?? []
          )
          for (const p of valid) {
            places[p.id] = p
            ids.add(p.id)
          }
          const lists = prev.lists.map(l =>
            l.id === DEFAULT_LIST_ID ? { ...l, placeIds: Array.from(ids) } : l
          )
          const next: ListsStore = { version: 1, lists, places }
          writeStore(next)
          return next
        })
      })
      .catch(() => {}) // server optional — local state stays authoritative
    return () => { cancelled = true }
  }, [])

  const update = useCallback((fn: (prev: ListsStore) => ListsStore) => {
    setStore(prev => {
      const next = fn(prev)
      writeStore(next)
      return next
    })
  }, [])

  /** Legacy view: favorites = places in the default "Saved" list. */
  const favorites: Place[] = useMemo(() => {
    const list = store.lists.find(l => l.id === DEFAULT_LIST_ID)
    if (!list) return []
    return list.placeIds
      .map(id => store.places[id])
      .filter((p): p is Place => Boolean(p))
  }, [store])

  const isFavorite = useCallback(
    (id: string) => favorites.some(p => p.id === id),
    [favorites]
  )

  const syncAdd = useCallback((place: Place) => {
    fetch('/api/favorites?localOnly=1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ place }),
    }).catch(() => {})
  }, [])

  const syncRemove = useCallback((id: string) => {
    fetch(`/api/favorites?id=${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {})
  }, [])

  const toggle = useCallback((place: Place) => {
    update(prev => {
      const list = prev.lists.find(l => l.id === DEFAULT_LIST_ID)!
      const exists = list.placeIds.includes(place.id)
      const places = { ...prev.places, [place.id]: place }
      const lists = prev.lists.map(l =>
        l.id === DEFAULT_LIST_ID
          ? {
              ...l,
              placeIds: exists
                ? l.placeIds.filter(id => id !== place.id)
                : [...l.placeIds, place.id],
            }
          : l
      )
      return { version: 1 as const, lists, places }
    })
    // Best-effort server sync — never blocks the UI.
    if (isFavorite(place.id)) syncRemove(place.id)
    else syncAdd(place)
  }, [update, isFavorite, syncAdd, syncRemove])

  const remove = useCallback((id: string) => {
    update(prev => {
      const stillUsedElsewhere = prev.lists.some(
        l => l.id !== DEFAULT_LIST_ID && l.placeIds.includes(id)
      )
      const places = { ...prev.places }
      if (!stillUsedElsewhere) delete places[id]
      const lists = prev.lists.map(l =>
        l.placeIds.includes(id)
          ? {
              ...l,
              placeIds: l.placeIds.filter(pid => pid !== id),
              notes: Object.fromEntries(
                Object.entries(l.notes).filter(([pid]) => pid !== id)
              ),
            }
          : l
      )
      return { version: 1 as const, lists, places }
    })
    syncRemove(id)
  }, [update, syncRemove])

  const persist = useCallback((next: Place[]) => {
    update(prev => {
      const places = { ...prev.places }
      for (const p of next) places[p.id] = p
      const lists = prev.lists.map(l =>
        l.id === DEFAULT_LIST_ID ? { ...l, placeIds: next.map(p => p.id) } : l
      )
      return { version: 1 as const, lists, places }
    })
  }, [update])

  // ── Named lists ──────────────────────────────────────────────────────────
  const lists = store.lists

  const createList = useCallback((name: string): string => {
    const trimmed = name.trim()
    const id = newId()
    update(prev => ({
      version: 1 as const,
      lists: [...prev.lists, { id, name: trimmed || 'Untitled list', placeIds: [], notes: {} }],
      places: prev.places,
    }))
    return id
  }, [update])

  const addToList = useCallback((place: Place, listId: string = DEFAULT_LIST_ID) => {
    update(prev => ({
      version: 1 as const,
      lists: prev.lists.map(l =>
        l.id === listId && !l.placeIds.includes(place.id)
          ? { ...l, placeIds: [...l.placeIds, place.id] }
          : l
      ),
      places: { ...prev.places, [place.id]: place },
    }))
  }, [update])

  const removeFromList = useCallback((placeId: string, listId: string) => {
    update(prev => {
      const target = prev.lists.find(l => l.id === listId)
      if (!target) return prev
      const usedElsewhere = prev.lists.some(
        l => l.id !== listId && l.placeIds.includes(placeId)
      )
      const places = { ...prev.places }
      if (!usedElsewhere) delete places[placeId]
      const lists = prev.lists.map(l =>
        l.id === listId
          ? {
              ...l,
              placeIds: l.placeIds.filter(pid => pid !== placeId),
              notes: Object.fromEntries(
                Object.entries(l.notes).filter(([pid]) => pid !== placeId)
            ),
          }
          : l
      )
      return { version: 1 as const, lists, places }
    })
  }, [update])

  const setNote = useCallback((placeId: string, listId: string, note: string) => {
    update(prev => ({
      version: 1 as const,
      lists: prev.lists.map(l => {
        if (l.id !== listId) return l
        const notes = { ...l.notes }
        const trimmed = note.trim()
        if (trimmed) notes[placeId] = trimmed
        else delete notes[placeId]
        return { ...l, notes }
      }),
      places: prev.places,
    }))
  }, [update])

  const deleteList = useCallback((id: string) => {
    if (id === DEFAULT_LIST_ID) return // the default list cannot be deleted
    update(prev => {
      const removed = prev.lists.find(l => l.id === id)
      const removedIds = new Set(removed?.placeIds ?? [])
      const remaining = prev.lists.filter(l => l.id !== id)
      const stillUsed = (pid: string) => remaining.some(l => l.placeIds.includes(pid))
      const places = { ...prev.places }
      for (const pid of Array.from(removedIds)) {
        if (!stillUsed(pid)) delete places[pid]
      }
      return { version: 1 as const, lists: remaining, places }
    })
  }, [update])

  return {
    favorites, isFavorite, toggle, remove, persist,
    lists, places: store.places, createList, addToList, removeFromList, setNote, deleteList,
  }
}
