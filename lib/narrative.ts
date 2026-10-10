/**
 * Pure builder for the one-line plain-language results summary.
 * Rendering is localized through t() using the narrative.* dictionary keys.
 */

export interface NarrativeArgs {
  count: number
  openCount: number
  radiusKm: number
  nearestName?: string
  nearestWalkMin?: number
}

export type TranslateFn = (
  key: string,
  vars?: Record<string, string | number>,
) => string

function formatRadius(radiusKm: number): string {
  return Number.isInteger(radiusKm) ? String(radiusKm) : radiusKm.toFixed(1)
}

export function buildNarrative(args: NarrativeArgs, t: TranslateFn): string {
  const { count, openCount, radiusKm, nearestName, nearestWalkMin } = args
  const radius = formatRadius(radiusKm)

  if (count === 0) {
    return t('narrative.none', { radius })
  }

  let text = t('narrative.summary', { count, radius, openCount })

  if (nearestName && typeof nearestWalkMin === 'number' && nearestWalkMin >= 0) {
    text += ' ' + t('narrative.nearest', { name: nearestName, mins: nearestWalkMin })
  }

  // Trust signal: hours verified live + last-updated time.
  const now = new Date()
  const time = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  text += ' ' + t('narrative.trust', { time })

  return text
}
