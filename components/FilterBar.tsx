'use client'
import Switch from './ui/switch'
import Select from './ui/select'
import type { SortKey } from './types'

export const RADIUS_OPTIONS = [1, 3, 5, 10]

interface FilterBarProps {
  openNow: boolean
  onOpenNowChange: (v: boolean) => void
  sort: SortKey
  onSortChange: (s: SortKey) => void
  radiusKm: number
  onRadiusChange: (r: number) => void
}

/**
 * Open-now toggle + sort select + radius selector.
 * Toggle/sort are LOCAL only; radius change triggers a new /api/search
 * (it is part of the TanStack query key).
 */
export default function FilterBar({
  openNow, onOpenNowChange, sort, onSortChange, radiusKm, onRadiusChange,
}: FilterBarProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        flexWrap: 'wrap',
      }}
      aria-label="Result filters"
    >
      {/* Open now toggle */}
      <label
        htmlFor="open-now-toggle"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)',
          cursor: 'pointer',
        }}
      >
        <Switch id="open-now-toggle" checked={openNow} onCheckedChange={onOpenNowChange} label="Open now only" />
        Open now
      </label>

      {/* Sort */}
      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        Sort
        <Select
          aria-label="Sort results"
          value={sort}
          onChange={e => onSortChange(e.target.value as SortKey)}
        >
          <option value="best">Best match</option>
          <option value="nearest">Nearest</option>
          <option value="rated">Top rated</option>
          <option value="reviewed">Most reviewed</option>
        </Select>
      </label>

      {/* Radius */}
      <div role="group" aria-label="Search radius" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
        {RADIUS_OPTIONS.map(r => {
          const active = radiusKm === r
          return (
            <button
              key={r}
              type="button"
              onClick={() => onRadiusChange(r)}
              aria-pressed={active}
              className={active ? 'chip chip-green' : 'chip chip-muted'}
              style={{ cursor: 'pointer', fontFamily: "'Satoshi', sans-serif", padding: '7px 13px' }}
            >
              {r} km
            </button>
          )
        })}
      </div>
    </div>
  )
}
