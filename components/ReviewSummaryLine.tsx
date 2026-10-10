'use client'
import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import type { Place } from './types'

interface Summary {
  summary?: string
  pros?: string[]
  cons?: string[]
  basedOn?: number
}

/**
 * AI review summary one-liner: "People love: X · Watch out for: Y".
 * Only renders for SerpApi-sourced places (OSM has no review data).
 * Fetches lazily from /api/reviews (24h cached, quota-minimal).
 */
export default function ReviewSummaryLine({ place }: { place: Place }) {
  const [data, setData] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(false)

  const dataId = place.dataId
  const isSerpApi = place.source === 'serpapi'

  useEffect(() => {
    if (!isSerpApi || !dataId) return
    let cancelled = false
    setLoading(true)
    fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataId, placeName: place.name }),
    })
      .then(r => (r.ok ? r.json() : null))
      .then(body => {
        if (!cancelled && body && (body.pros?.length || body.cons?.length || body.summary)) {
          setData(body)
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [isSerpApi, dataId, place.name])

  if (!isSerpApi || !dataId) return null
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '6px' }}>
        <Sparkles size={13} style={{ animation: 'pulse 1.5s ease-in-out infinite' }} aria-hidden />
        Summarizing reviews…
      </div>
    )
  }
  if (!data) return null

  const love = data.pros?.[0]
  const watch = data.cons?.[0]
  if (!love && !watch && !data.summary) return null

  return (
    <div
      style={{
        marginTop: '8px',
        padding: '8px 12px',
        borderRadius: '12px',
        background: 'rgba(123,97,255,0.08)',
        border: '1px solid rgba(123,97,255,0.2)',
        fontSize: '0.8rem',
        lineHeight: 1.5,
        color: 'var(--text-primary)',
      }}
      aria-label="AI review summary"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', fontWeight: 700, fontSize: '0.75rem', color: 'var(--accent-purple)' }}>
        <Sparkles size={13} aria-hidden /> AI review summary
        {data.basedOn ? <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>· {data.basedOn} reviews</span> : null}
      </div>
      {love && (
        <div>
          <span style={{ fontWeight: 600 }}>People love:</span> {love}
        </div>
      )}
      {watch && (
        <div style={{ marginTop: '2px' }}>
          <span style={{ fontWeight: 600 }}>Watch out for:</span> {watch}
        </div>
      )}
      {!love && !watch && data.summary && <div>{data.summary}</div>}
    </div>
  )
}
