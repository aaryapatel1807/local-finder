'use client'
import { useMemo, useState } from 'react'
import { Heart, Search } from 'lucide-react'
import ScenicBackdrop from '../../components/shared/ScenicBackdrop'
import GlassCard from '../../components/shared/GlassCard'
import PlaceCard from '../../components/PlaceCard'
import PlaceSheet from '../../components/PlaceSheet'
import Toast from '../../components/Toast'
import { useFavorites } from '../../hooks/useFavorites'
import { semanticScore } from '../../lib/semantic'
import type { Place } from '../../components/types'

export default function SavedPage() {
  const { favorites, isFavorite, toggle } = useFavorites()
  const [aiDisabled, setAiDisabled] = useState(false)
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const visibleFavorites = useMemo(() => {
    const q = searchQuery.trim()
    if (!q) return favorites
    return favorites
      .map(place => ({ place, score: semanticScore(q, place) }))
      .filter(entry => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(entry => entry.place)
  }, [favorites, searchQuery])

  const sharePlace = (place: Place) => {
    const params = new URLSearchParams({
      q: place.name,
      lat: String(place.lat),
      lng: String(place.lng),
      r: '3',
      place: place.id,
    })
    const url = `${window.location.origin}/?${params.toString()}`
    const done = () => {
      setToast('Link copied')
      setTimeout(() => setToast(null), 2400)
    }
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(done, () => setToast('Could not copy the link'))
    }
  }

  return (
    <div style={{ position: 'relative', zIndex: 1 }}>
      <ScenicBackdrop />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', marginBottom: '4px' }}>Saved places</h2>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }} aria-live="polite">
            {favorites.length === 0
              ? 'Tap the heart on any result to save it here.'
              : `${favorites.length} saved place${favorites.length === 1 ? '' : 's'}`}
          </p>
        </div>

        {favorites.length === 0 ? (
          <GlassCard className="flex flex-col items-center text-center py-12 px-6">
            <div
              style={{
                width: 56, height: 56, borderRadius: '50%',
                background: 'var(--track)', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-muted)', marginBottom: 12,
              }}
            >
              <Heart size={26} />
            </div>
            <h3 style={{ fontSize: '1.05rem', marginBottom: 6 }}>Nothing saved yet</h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', maxWidth: 320 }}>
              Search for a place on Home and tap the heart icon — it will appear here,
              even when you're offline.
            </p>
          </GlassCard>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ position: 'relative' }}>
              <Search
                size={16}
                style={{
                  position: 'absolute', left: 12, top: '50%',
                  transform: 'translateY(-50%)', color: 'var(--text-muted)',
                  pointerEvents: 'none',
                }}
              />
              <input
                type="search"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search saved places — e.g. 'quiet cafe'"
                aria-label="Search saved places"
                style={{
                  width: '100%', padding: '10px 12px 10px 36px',
                  borderRadius: '12px', border: '1px solid var(--border)',
                  background: 'var(--glass-bg)', color: 'var(--text)',
                  fontSize: '0.9rem',
                }}
              />
            </div>
            {visibleFavorites.length === 0 && searchQuery.trim() !== '' && (
              <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                No saved places match “{searchQuery.trim()}”.
              </p>
            )}
            {visibleFavorites.map(place => (
              <div key={place.id} id={`place-card-${place.id}`}>
                <PlaceCard
                  place={place}
                  isFavorite={isFavorite(place.id)}
                  onToggleFavorite={toggle}
                  onOpen={setSelectedPlace}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <PlaceSheet
        place={selectedPlace}
        onClose={() => setSelectedPlace(null)}
        isFavorite={selectedPlace ? isFavorite(selectedPlace.id) : false}
        onToggleFavorite={toggle}
        onShare={sharePlace}
        aiDisabled={aiDisabled}
        onAiDisabled={() => setAiDisabled(true)}
      />
      <Toast message={toast} />
    </div>
  )
}
