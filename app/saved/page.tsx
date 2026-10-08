'use client'
import { useMemo, useState } from 'react'
import { Heart, Search, Pencil, Plus, Trash2, Check, X } from 'lucide-react'
import ScenicBackdrop from '../../components/shared/ScenicBackdrop'
import GlassCard from '../../components/shared/GlassCard'
import Button from '../../components/ui/button'
import PlaceCard from '../../components/PlaceCard'
import PlaceSheet from '../../components/PlaceSheet'
import Toast from '../../components/Toast'
import { useFavorites, DEFAULT_LIST_ID } from '../../hooks/useFavorites'
import type { SavedList } from '../../hooks/useFavorites'
import { semanticScore } from '../../lib/semantic'
import { useLanguage } from '../../hooks/useLanguage'
import type { Place } from '../../components/types'

export default function SavedPage() {
  const { t } = useLanguage()
  const { favorites, isFavorite, toggle, lists, places, createList, removeFromList, setNote, deleteList } = useFavorites()
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
      setToast(t('toast.linkCopied'))
      setTimeout(() => setToast(null), 2400)
    }
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(done, () => setToast(t('toast.copyFailed')))
    }
  }

  return (
    <div style={{ position: 'relative', zIndex: 1 }}>
      <ScenicBackdrop />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', marginBottom: '4px' }}>{t('saved.title')}</h2>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }} aria-live="polite">
            {favorites.length === 0
              ? t('saved.emptyBody')
              : favorites.length === 1
                ? t('saved.countOne')
                : t('saved.countMany', { count: favorites.length })}
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
            <h3 style={{ fontSize: '1.05rem', marginBottom: 6 }}>{t('saved.emptyTitle')}</h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', maxWidth: 320 }}>
              {t('saved.emptyBodyOffline')}
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
                placeholder={t('saved.searchPlaceholder')}
                aria-label={t('saved.searchAria')}
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
                {t('saved.noMatch', { q: searchQuery.trim() })}
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

        {/* ── Saved lists (phase2/planner, additive) ──────────────────────── */}
        <ListsSection
          lists={lists}
          places={places}
          createList={createList}
          removeFromList={removeFromList}
          setNote={setNote}
          deleteList={deleteList}
          onOpenPlace={setSelectedPlace}
        />
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
/* ── Saved lists UI (phase2/planner — additive; rendered below the existing
 * favorites content). ─────────────────────────────────────────────────── */

interface ListsSectionProps {
  lists: SavedList[]
  places: Record<string, Place>
  createList: (name: string) => string
  removeFromList: (placeId: string, listId: string) => void
  setNote: (placeId: string, listId: string, note: string) => void
  deleteList: (id: string) => void
  onOpenPlace: (place: Place) => void
}

function ListsSection({
  lists, places, createList, removeFromList, setNote, deleteList, onOpenPlace,
}: ListsSectionProps) {
  const { t } = useLanguage()
  const [activeId, setActiveId] = useState<string>(DEFAULT_LIST_ID)
  const [draftName, setDraftName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [noteDraft, setNoteDraft] = useState('')

  const active = lists.find(l => l.id === activeId)
    ?? lists.find(l => l.id === DEFAULT_LIST_ID)
    ?? lists[0]
  const members = active
    ? active.placeIds.map(id => places[id]).filter((p): p is Place => Boolean(p))
    : []

  const submitList = () => {
    const id = createList(draftName)
    setDraftName('')
    setActiveId(id)
  }

  return (
    <GlassCard style={{ padding: '20px' }}>
      <h3 style={{ fontSize: '1.05rem', marginBottom: '4px' }}>{t('saved.listsTitle')}</h3>
      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
        {t('saved.listsBody')}
      </p>

      {/* List tabs */}
      <div role="tablist" aria-label={t('saved.listsAria')} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
        {lists.map(l => {
          const isActive = active?.id === l.id
          return (
            <button
              key={l.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => { setActiveId(l.id); setEditingId(null) }}
              className={isActive ? 'chip chip-green' : 'chip chip-muted'}
              style={{ cursor: 'pointer', fontFamily: "'Satoshi', sans-serif", padding: '7px 13px' }}
            >
              {l.name} ({l.placeIds.length})
            </button>
          )
        })}
      </div>

      {/* Create a list */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
        <input
          aria-label={t('saved.newListAria')}
          value={draftName}
          onChange={e => setDraftName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submitList() }}
          placeholder={t('saved.newListPlaceholder')}
          style={{
            flex: 1, minWidth: 180,
            background: 'var(--input-bg)', border: '1px solid var(--input-border)',
            borderRadius: '12px', color: 'var(--text-primary)',
            padding: '10px 12px', fontSize: '0.88rem', fontFamily: "'Satoshi', sans-serif",
          }}
        />
        <Button variant="ghost" onClick={submitList}>
          <Plus size={15} /> {t('saved.newList')}
        </Button>
      </div>

      {active && active.id !== DEFAULT_LIST_ID && (
        <div style={{ marginBottom: '12px' }}>
          <Button
            variant="ghost"
            onClick={() => {
              if (window.confirm(t('saved.deleteConfirm', { name: active.name }))) {
                deleteList(active.id)
                setActiveId(DEFAULT_LIST_ID)
              }
            }}
            style={{ fontSize: '0.8rem', color: 'var(--error, #e5484d)' }}
          >
            <Trash2 size={14} /> {t('saved.deleteList')}
          </Button>
        </div>
      )}

      {/* List members with notes */}
      {members.length === 0 ? (
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          {active?.id === DEFAULT_LIST_ID
            ? t('saved.defaultListEmpty')
            : t('saved.listEmpty')}
        </p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {members.map(place => {
            const note = active?.notes[place.id] ?? ''
            const isEditing = editingId === place.id
            return (
              <li
                key={place.id}
                style={{
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: '12px', padding: '10px 12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => onOpenPlace(place)}
                    style={{
                      background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                      fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)',
                      fontFamily: "'Satoshi', sans-serif", textAlign: 'left',
                    }}
                  >
                    {place.name}
                  </button>
                  <button
                    type="button"
                    aria-label={t('saved.removeFromList', { place: place.name, list: active?.name ?? '' })}
                    onClick={() => removeFromList(place.id, active!.id)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--text-muted)', padding: '4px',
                    }}
                    title={t('saved.removeTitle')}
                  >
                    <X size={15} />
                  </button>
                </div>

                {isEditing ? (
                  <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                    <input
                      aria-label={t('saved.noteAria', { name: place.name })}
                      value={noteDraft}
                      onChange={e => setNoteDraft(e.target.value)}
                      placeholder={t('saved.notePlaceholder')}
                      autoFocus
                      style={{
                        flex: 1, minWidth: 0,
                        background: 'var(--input-bg)', border: '1px solid var(--input-border)',
                        borderRadius: '10px', color: 'var(--text-primary)',
                        padding: '8px 10px', fontSize: '0.85rem', fontFamily: "'Satoshi', sans-serif",
                      }}
                    />
                    <Button
                      variant="ghost"
                      onClick={() => { setNote(place.id, active!.id, noteDraft); setEditingId(null) }}
                      style={{ padding: '8px 10px' }}
                      aria-label={t('saved.saveNote')}
                    >
                      <Check size={15} />
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => setEditingId(null)}
                      style={{ padding: '8px 10px' }}
                      aria-label={t('saved.cancel')}
                    >
                      <X size={15} />
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setEditingId(place.id); setNoteDraft(note) }}
                    style={{
                      background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px',
                      fontSize: '0.82rem', color: note ? 'var(--text-primary)' : 'var(--text-muted)',
                      fontFamily: "'Satoshi', sans-serif", textAlign: 'left',
                    }}
                  >
                    <Pencil size={13} />
                    {note || t('saved.addNote')}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </GlassCard>
  )
}
