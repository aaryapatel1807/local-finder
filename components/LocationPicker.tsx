'use client'
import { useState } from 'react'
import dynamic from 'next/dynamic'
import { MapPin } from 'lucide-react'
import GlassCard from './shared/GlassCard'
import Button from './ui/button'
import type { Coords } from '../hooks/useGeolocation'

const PinMap = dynamic(() => import('./LocationPinPicker'), {
  ssr: false,
  loading: () => (
    <div
      className="glass"
      style={{ height: 300, borderRadius: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}
    >
      Loading map…
    </div>
  ),
})

export const PINNED_STORAGE_KEY = 'localfinder_pinned'

interface LocationPickerProps {
  initialCoords?: Coords | null
  onConfirm: (coords: Coords) => void
  onCancel: () => void
}

/**
 * "Set on map" mode: draggable-pin map + Confirm. Confirm sets the app
 * location, labels it "Pinned location" and persists the pin to localStorage
 * so it survives reloads.
 */
export default function LocationPicker({ initialCoords, onConfirm, onCancel }: LocationPickerProps) {
  const fallback: Coords = { lat: 22.3072, lng: 73.1812 } // Vadodara
  const [picked, setPicked] = useState<Coords>(initialCoords ?? fallback)

  const confirm = () => {
    try {
      window.localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(picked))
    } catch {}
    onConfirm(picked)
  }

  return (
    <div role="dialog" aria-label="Set location on map">
    <GlassCard padding="p-4">
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <MapPin size={16} style={{ color: 'var(--accent)' }} aria-hidden />
        <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>Set your location on the map</span>
      </div>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
        Drag the pin or tap anywhere on the map, then confirm.
      </p>
      <PinMap initial={picked} onChange={setPicked} />
      <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
        <Button variant="primary" onClick={confirm} style={{ flex: 1 }}>
          Confirm location
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </GlassCard>
    </div>
  )
}
