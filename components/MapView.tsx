'use client'
import dynamic from 'next/dynamic'
import type { Place } from './types'

const LeafletMap = dynamic(() => import('./LeafletMap'), {
  ssr: false,
  loading: () => (
    <div
      className="glass"
      style={{ height: 420, borderRadius: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}
    >
      Loading map…
    </div>
  ),
})

export interface MapViewProps {
  places: Place[]
  userLat?: number
  userLng?: number
  selectedId?: string | null
  onMarkerSelect: (id: string) => void
}

/** Map toggle view — Leaflet loads only in the browser (ssr: false). */
export default function MapView(props: MapViewProps) {
  return <LeafletMap {...props} />
}
