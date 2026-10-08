'use client'
import { useState } from 'react'
import { Loader2, Users } from 'lucide-react'
import GlassCard from './shared/GlassCard'
import Button from './ui/button'
import { midpoint } from '../lib/errands'

interface Props {
  myCoords: { lat: number; lng: number } | null
  onMeet: (coords: { lat: number; lng: number }, label: string) => void
}

interface GeoPoint {
  lat: number
  lng: number
  label: string
}

interface GeocodeResponse {
  lat: number
  lng: number
  label?: string
}

interface RowState {
  text: string
  useMine: boolean
}

const emptyRow = (useMine: boolean): RowState => ({ text: '', useMine })

/**
 * GET /api/geocode?q=… — contract: 200 {lat,lng,label} | 404 when not found.
 */
async function geocode(query: string): Promise<GeoPoint> {
  const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`, {
    headers: { Accept: 'application/json' },
  })
  if (res.status === 404) throw new Error(`Could not find "${query}".`)
  if (!res.ok) throw new Error(`Could not look up "${query}" — try again.`)
  const body = (await res.json()) as GeocodeResponse
  if (!Number.isFinite(body.lat) || !Number.isFinite(body.lng)) {
    throw new Error(`Could not look up "${query}" — try again.`)
  }
  return { lat: body.lat, lng: body.lng, label: body.label || query }
}

export default function MeetInMiddle({ myCoords, onMeet }: Props) {
  const [rowA, setRowA] = useState<RowState>(() => emptyRow(myCoords !== null))
  const [rowB, setRowB] = useState<RowState>(() => emptyRow(false))
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const resolveRow = async (row: RowState, fallback: string): Promise<GeoPoint> => {
    if (row.useMine) {
      if (!myCoords) throw new Error('Your location is not available — type a place instead.')
      return { lat: myCoords.lat, lng: myCoords.lng, label: 'My location' }
    }
    const q = row.text.trim()
    if (!q) throw new Error(`Enter a location for ${fallback}, or use your location.`)
    return geocode(q)
  }

  const submit = async () => {
    setError(null)
    setBusy(true)
    try {
      const [a, b] = await Promise.all([
        resolveRow(rowA, 'person A'),
        resolveRow(rowB, 'person B'),
      ])
      const mid = midpoint({ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng })
      const labels = `${a.label} ↔ ${b.label}`
      onMeet(mid, `Midpoint · ${labels}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong — try again.')
    } finally {
      setBusy(false)
    }
  }

  const renderRow = (
    title: string,
    row: RowState,
    setRow: (r: RowState) => void
  ) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, minWidth: 180 }}>
      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>{title}</span>
      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          aria-label={`${title} location`}
          value={row.useMine ? '' : row.text}
          placeholder={row.useMine ? 'Using your location' : 'Type a place or area'}
          disabled={row.useMine || busy}
          onChange={e => setRow({ text: e.target.value, useMine: false })}
          onKeyDown={e => { if (e.key === 'Enter') submit() }}
          style={{
            flex: 1, minWidth: 0,
            background: 'var(--input-bg)', border: '1px solid var(--input-border)',
            borderRadius: '12px', color: 'var(--text-primary)',
            padding: '12px 14px', fontSize: '0.9rem', fontFamily: "'Satoshi', sans-serif",
            opacity: row.useMine ? 0.6 : 1,
          }}
        />
        <Button
          variant="ghost"
          onClick={() => setRow({ text: '', useMine: true })}
          disabled={busy || !myCoords}
          title={myCoords ? 'Use your current location' : 'Location unavailable'}
          style={{ flexShrink: 0 }}
        >
          Use my location
        </Button>
      </div>
    </div>
  )

  return (
    <GlassCard style={{ padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
        <Users size={18} color="var(--accent)" />
        <h3 style={{ fontSize: '1.05rem' }}>Meet in the middle</h3>
      </div>
      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
        Two starting points — I'll find the halfway spot so you can search around it.
      </p>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        {renderRow('Person A', rowA, setRowA)}
        {renderRow('Person B', rowB, setRowB)}
      </div>

      <div style={{ marginTop: '12px' }}>
        <Button variant="primary" onClick={submit} disabled={busy}>
          {busy ? <Loader2 size={16} style={{ animation: 'spin-slow 1.2s linear infinite' }} /> : null}
          {busy ? 'Finding midpoint…' : 'Find midpoint'}
        </Button>
      </div>

      {error && (
        <p role="alert" style={{ fontSize: '0.85rem', color: 'var(--error, #e5484d)', marginTop: '10px' }}>
          {error}
        </p>
      )}
    </GlassCard>
  )
}
