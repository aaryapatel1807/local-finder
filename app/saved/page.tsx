'use client'
import { useState } from 'react'
import { Heart, Pencil, Plus, Trash2, Check, X } from 'lucide-react'
import ScenicBackdrop from '../../components/shared/ScenicBackdrop'
import GlassCard from '../../components/shared/GlassCard'
import Button from '../../components/ui/button'
import PlaceCard from '../../components/PlaceCard'
import PlaceSheet from '../../components/PlaceSheet'
import Toast from '../../components/Toast'
import { useFavorites, DEFAULT_LIST_ID } from '../../hooks/useFavorites'
import type { SavedList } from '../../hooks/useFavorites'
import type { Place } from '../../components/types'

export default function SavedPage() {
  const { favorites, isFavorite, toggle, lists, places, createList, removeFromList, setNote, deleteList } = useFavorites()
  const [aiDisabled, setAiDisabled] = useState(false)
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null)
  const [toast, setToast] = useState<string | null>(null)

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
            {favorites.map(place => (
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
      <h3 style={{ fontSize: '1.05rem', marginBottom: '4px' }}>My lists</h3>
      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
        Group saved places into lists and add notes to each one.
      </p>

      {/* List tabs */}
      <div role="tablist" aria-label="Saved lists" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
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
          aria-label="New list name"
          value={draftName}
          onChange={e => setDraftName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submitList() }}
          placeholder="New list name — e.g. Weekend food"
          style={{
            flex: 1, minWidth: 180,
            background: 'var(--input-bg)', border: '1px solid var(--input-border)',
            borderRadius: '12px', color: 'var(--text-primary)',
            padding: '10px 12px', fontSize: '0.88rem', fontFamily: "'Satoshi', sans-serif",
          }}
        />
        <Button variant="ghost" onClick={submitList}>
          <Plus size={15} /> New list
        </Button>
      </div>

      {active && active.id !== DEFAULT_LIST_ID && (
        <div style={{ marginBottom: '12px' }}>
          <Button
            variant="ghost"
            onClick={() => {
              if (window.confirm(`Delete the list "${active.name}"? Its notes will be removed.`)) {
                deleteList(active.id)
                setActiveId(DEFAULT_LIST_ID)
              }
            }}
            style={{ fontSize: '0.8rem', color: 'var(--error, #e5484d)' }}
          >
            <Trash2 size={14} /> Delete list
          </Button>
        </div>
      )}

      {/* List members with notes */}
      {members.length === 0 ? (
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          {active?.id === DEFAULT_LIST_ID
            ? 'Saved favorites appear here. Heart a place on Home to add it.'
            : 'This list is empty. Heart a place on Home, then move it here from Favorites later — or add it from any place sheet.'}
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
                    aria-label={`Remove ${place.name} from ${active?.name}`}
                    onClick={() => removeFromList(place.id, active!.id)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--text-muted)', padding: '4px',
                    }}
                    title="Remove from list"
                  >
                    <X size={15} />
                  </button>
                </div>

                {isEditing ? (
                  <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                    <input
                      aria-label={`Note for ${place.name}`}
                      value={noteDraft}
                      onChange={e => setNoteDraft(e.target.value)}
                      placeholder="Add a note…"
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
                      aria-label="Save note"
                    >
                      <Check size={15} />
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => setEditingId(null)}
                      style={{ padding: '8px 10px' }}
                      aria-label="Cancel"
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
                    {note || 'Add a note'}
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
