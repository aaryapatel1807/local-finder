'use client'
import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { MapViewProps } from './MapView'

// Fix Leaflet's default marker icon paths inside Next.js bundles.
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const userIcon = L.divIcon({
  className: 'lf-user-dot',
  html: '<div style="width:16px;height:16px;border-radius:50%;background:#15B2CF;border:3px solid #fff;box-shadow:0 0 0 3px rgba(21,178,207,0.35);"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
})

function popupHtml(p: { name: string; rating?: number; distanceKm?: number }): string {
  const rating = p.rating !== undefined ? `★ ${p.rating.toFixed(1)}` : 'No rating'
  const dist = p.distanceKm !== undefined
    ? (p.distanceKm < 1 ? ` · ${Math.round(p.distanceKm * 1000)} m` : ` · ${p.distanceKm.toFixed(1)} km`)
    : ''
  const name = p.name.replace(/</g, '&lt;')
  return `<div style="font-family:'Satoshi',sans-serif;min-width:140px"><strong>${name}</strong><div style="font-size:0.8rem">${rating}${dist}</div></div>`
}

/** Client-only Leaflet map (imported via dynamic ssr:false from MapView). */
export default function LeafletMap({ places, userLat, userLng, selectedId, onMarkerSelect }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markersRef = useRef<Record<string, L.Marker>>({})
  const onSelectRef = useRef(onMarkerSelect)
  onSelectRef.current = onMarkerSelect

  // Create the map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = L.map(containerRef.current, { scrollWheelZoom: true }).setView([22.3072, 73.1812], 14)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map)
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
      markersRef.current = {}
    }
  }, [])

  // Sync markers + bounds whenever places or user location change.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const layer = L.layerGroup()
    markersRef.current = {}

    if (userLat !== undefined && userLng !== undefined) {
      L.marker([userLat, userLng], { icon: userIcon }).bindPopup('You are here').addTo(layer)
    }
    for (const p of places) {
      const m = L.marker([p.lat, p.lng])
        .bindPopup(popupHtml(p))
        .on('click', () => onSelectRef.current(p.id))
      markersRef.current[p.id] = m
      m.addTo(layer)
    }
    layer.addTo(map)

    const pts: [number, number][] = places.map(p => [p.lat, p.lng])
    if (userLat !== undefined && userLng !== undefined) pts.push([userLat, userLng])
    if (pts.length > 0) map.fitBounds(L.latLngBounds(pts), { padding: [48, 48], maxZoom: 15 })

    return () => { map.removeLayer(layer) }
  }, [places, userLat, userLng])

  // Open the selected marker's popup when selection changes.
  useEffect(() => {
    if (selectedId && markersRef.current[selectedId]) {
      markersRef.current[selectedId].openPopup()
    }
  }, [selectedId])

  return (
    <div
      className="glass"
      style={{ borderRadius: '26px', overflow: 'hidden', height: 420 }}
      role="application"
      aria-label="Map of nearby places"
    >
      <div ref={containerRef} style={{ height: '100%', width: '100%', zIndex: 1 }} />
    </div>
  )
}
