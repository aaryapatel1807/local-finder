'use client'
import { useEffect, useState } from 'react'
import { Building2, Coffee, Cross, Fuel, Hospital, Pill, ShoppingCart, Wrench } from 'lucide-react'
import type { Place } from './types'

/** Category -> fallback icon when no photo is available. */
function CategoryIcon({ category }: { category?: string }) {
  const c = (category || '').toLowerCase()
  const props = { size: 32, style: { color: 'var(--text-muted)', opacity: 0.6 } }
  if (c.includes('pharmacy') || c.includes('medical')) return <Pill {...props} aria-hidden />
  if (c.includes('hospital') || c.includes('clinic')) return <Hospital {...props} aria-hidden />
  if (c.includes('chai') || c.includes('cafe') || c.includes('coffee')) return <Coffee {...props} aria-hidden />
  if (c.includes('fuel') || c.includes('petrol')) return <Fuel {...props} aria-hidden />
  if (c.includes('grocery') || c.includes('supermarket')) return <ShoppingCart {...props} aria-hidden />
  if (c.includes('mechanic') || c.includes('repair')) return <Wrench {...props} aria-hidden />
  if (c.includes('atm') || c.includes('bank')) return <Building2 {...props} aria-hidden />
  return <Cross {...props} aria-hidden />
}

/**
 * Place photo: SerpApi thumbnail when available, otherwise lazy Wikimedia
 * Commons lookup by name, otherwise a category illustration. Never blocks
 * the card — the image area fades in when loaded.
 */
export default function PlaceImage({ place, city }: { place: Place; city?: string }) {
  const [commonsUrl, setCommonsUrl] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)

  const serpApiThumb = place.thumbnail
  const needsCommons = !serpApiThumb && place.source !== 'serpapi'

  useEffect(() => {
    if (!needsCommons) return
    let cancelled = false
    fetch(`/api/images?name=${encodeURIComponent(place.name)}${city ? `&city=${encodeURIComponent(city)}` : ''}`)
      .then(r => (r.ok ? r.json() : null))
      .then(body => {
        if (!cancelled && body?.image?.url) setCommonsUrl(body.image.url)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [needsCommons, place.name, city])

  const src = serpApiThumb || commonsUrl

  return (
    <div
      style={{
        width: '100%',
        height: '140px',
        borderRadius: '12px',
        overflow: 'hidden',
        background: 'var(--track)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '10px',
        position: 'relative',
      }}
      aria-hidden={!src}
    >
      {src && !failed ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: loaded ? 1 : 0,
            transition: 'opacity 0.4s ease',
          }}
        />
      ) : (
        <CategoryIcon category={place.category} />
      )}
      {!serpApiThumb && src && (
        <span
          style={{
            position: 'absolute',
            bottom: '6px',
            right: '8px',
            fontSize: '0.65rem',
            color: 'rgba(255,255,255,0.9)',
            background: 'rgba(0,0,0,0.45)',
            borderRadius: '6px',
            padding: '2px 6px',
          }}
        >
          Wikimedia Commons
        </span>
      )}
    </div>
  )
}
