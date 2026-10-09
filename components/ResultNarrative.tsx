'use client'
import { buildNarrative } from '../lib/narrative'
import { useLanguage } from '../hooks/useLanguage'

/**
 * One-line plain-language summary rendered above the results list.
 * Kept as a plain <p> on purpose: the page already has an aria-live region.
 */
export interface ResultNarrativeProps {
  count: number
  openCount: number
  radiusKm: number
  nearestName?: string
  nearestWalkMin?: number
}

export default function ResultNarrative({
  count,
  openCount,
  radiusKm,
  nearestName,
  nearestWalkMin,
}: ResultNarrativeProps) {
  const { t } = useLanguage()

  return (
    <p
      style={{
        margin: 0,
        fontSize: '0.88rem',
        color: 'var(--text-muted)',
        lineHeight: 1.5,
        fontFamily: "'Satoshi', sans-serif",
      }}
    >
      {buildNarrative({ count, openCount, radiusKm, nearestName, nearestWalkMin }, t)}
    </p>
  )
}
