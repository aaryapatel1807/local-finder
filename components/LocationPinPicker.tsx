'use client'
import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Coords } from '../hooks/useGeolocation'

// Fix Leaflet's default marker icon paths inside Next.js bundles.
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

interface LocationPinPickerProps {
  initial: Coords
  onChange: (coords: Coords) => void
}

/**
 * Client-only Leaflet map with a draggable pin (imported via dynamic
 * ssr:false from LocationPicker). Tap the map or drag the pin to set
 * the location.
 */
export default function LocationPinPicker({ initial, onChange }: LocationPinPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = L.map(containerRef.current, { scrollWheelZoom: true }).setView([initial.lat, initial.lng], 15)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map)

    const marker = L.marker([initial.lat, initial.lng], { draggable: true }).addTo(map)
    markerRef.current = marker
    marker.on('dragend', () => {
      const ll = marker.getLatLng()
      onChangeRef.current({ lat: ll.lat, lng: ll.lng })
    })
    map.on('click', (e: L.LeafletMouseEvent) => {
      marker.setLatLng(e.latlng)
      onChangeRef.current({ lat: e.latlng.lat, lng: e.latlng.lng })
    })
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      className="glass"
      style={{ borderRadius: '18px', overflow: 'hidden', height: 300 }}
      role="application"
      aria-label="Pick your location on the map"
    >
      <div ref={containerRef} style={{ height: '100%', width: '100%', zIndex: 1 }} />
    </div>
  )
}
