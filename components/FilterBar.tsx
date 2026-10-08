'use client'
import Switch from './ui/switch'
import Select from './ui/select'
import type { SortKey } from './types'
import { useLanguage } from '../hooks/useLanguage'

export const RADIUS_OPTIONS = [1, 3, 5, 10]

/** 'foryou' is the personalized sort — behaves like 'best' until the
 *  personalized rerank hook lands (Phase 2 frontend workstream B). */
export type SortKeyExt = SortKey | 'foryou'

/** Price bands over the place.price field ('₹', '₹₹', '₹₹₹'…). */
export type PriceBand = 'any' | '₹' | '₹₹' | '₹₹₹+'
export const PRICE_BANDS: PriceBand[] = ['any', '₹', '₹₹', '₹₹₹+']

interface FilterBarProps {
  openNow: boolean
  onOpenNowChange: (v: boolean) => void
  sort: SortKeyExt
  onSortChange: (s: SortKeyExt) => void
  radiusKm: number
  onRadiusChange: (r: number) => void
  priceBand: PriceBand
  onPriceBandChange: (b: PriceBand) => void
}

/**
 * Open-now toggle + sort select + radius selector + price chips.
 * Toggle/sort/price are LOCAL only; radius change triggers a new /api/search
 * (it is part of the TanStack query key).
 */
export default function FilterBar({
  openNow, onOpenNowChange, sort, onSortChange, radiusKm, onRadiusChange,
  priceBand, onPriceBandChange,
}: FilterBarProps) {
  const { t } = useLanguage()
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        flexWrap: 'wrap',
      }}
      aria-label={t('filters.aria')}
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
        <Switch id="open-now-toggle" checked={openNow} onCheckedChange={onOpenNowChange} label={t('filters.openNowOnly')} />
        {t('filters.openNow')}
      </label>

      {/* Sort */}
      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        {t('filters.sort')}
        <Select
          aria-label={t('filters.sortAria')}
          value={sort}
          onChange={e => onSortChange(e.target.value as SortKeyExt)}
        >
          <option value="foryou">{t('sort.foryou')}</option>
          <option value="best">{t('sort.best')}</option>
          <option value="nearest">{t('sort.nearest')}</option>
          <option value="rated">{t('sort.rated')}</option>
          <option value="reviewed">{t('sort.reviewed')}</option>
        </Select>
      </label>

      {/* Price */}
      <div role="group" aria-label={t('filters.priceAria')} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
        {PRICE_BANDS.map(b => {
          const active = priceBand === b
          return (
            <button
              key={b}
              type="button"
              onClick={() => onPriceBandChange(b)}
              aria-pressed={active}
              aria-label={b === 'any' ? t('filters.anyPriceAria') : b === '₹₹₹+' ? t('filters.priceHigh') : t('filters.priceBand', { band: b })}
              className={active ? 'chip chip-green' : 'chip chip-muted'}
              style={{ cursor: 'pointer', fontFamily: "'Satoshi', sans-serif", padding: '7px 13px' }}
            >
              {b === 'any' ? t('filters.anyPrice') : b}
            </button>
          )
        })}
      </div>

      {/* Radius */}
      <div role="group" aria-label={t('filters.radiusAria')} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
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
              {t('filters.radiusUnit', { n: r })}
            </button>
          )
        })}
      </div>
    </div>
  )
}
