import { describe, expect, it } from 'vitest'
import { buildNarrative, type TranslateFn } from './narrative'

const TEMPLATES: Record<string, string> = {
  'narrative.summary': '{count} places within {radius} km, {openCount} open right now.',
  'narrative.none': 'No places found within {radius} km. Try widening your search area.',
  'narrative.nearest': 'Nearest: {name}, {mins} min walk.',
}

/** Stub t() that mirrors the dictionary's {var} interpolation. */
const t: TranslateFn = (key, vars) =>
  (TEMPLATES[key] ?? key).replace(/\{(\w+)\}/g, (m, name) =>
    vars && vars[name] !== undefined ? String(vars[name]) : m,
  )

describe('buildNarrative', () => {
  it('uses the none template when count is zero', () => {
    expect(buildNarrative({ count: 0, openCount: 0, radiusKm: 5 }, t)).toBe(
      'No places found within 5 km. Try widening your search area.',
    )
  })

  it('summarizes count, radius and open count', () => {
    expect(buildNarrative({ count: 7, openCount: 5, radiusKm: 3 }, t)).toBe(
      '7 places within 3 km, 5 open right now.',
    )
  })

  it('appends the nearest-place line when both nearest fields are present', () => {
    expect(
      buildNarrative(
        {
          count: 7,
          openCount: 5,
          radiusKm: 3,
          nearestName: 'Apollo Pharmacy',
          nearestWalkMin: 12,
        },
        t,
      ),
    ).toBe(
      '7 places within 3 km, 5 open right now. Nearest: Apollo Pharmacy, 12 min walk.',
    )
  })

  it('skips the nearest line when nearest info is absent', () => {
    expect(buildNarrative({ count: 2, openCount: 1, radiusKm: 4 }, t)).not.toContain('Nearest:')
  })

  it('formats integer radii without decimals', () => {
    expect(buildNarrative({ count: 0, openCount: 0, radiusKm: 10 }, t)).toContain(
      'within 10 km',
    )
  })

  it('formats fractional radii with one decimal', () => {
    expect(buildNarrative({ count: 1, openCount: 0, radiusKm: 2.5 }, t)).toContain(
      'within 2.5 km',
    )
  })
})
