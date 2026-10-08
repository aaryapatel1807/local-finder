'use client'
import Skeleton from './ui/skeleton'

/** Loading shimmer card mirroring the PlaceCard layout. */
export default function SkeletonCard() {
  return (
    <div
      className="glass p-4 flex gap-3"
      style={{ borderRadius: '26px' }}
      aria-hidden
    >
      <Skeleton style={{ width: 72, height: 72, borderRadius: 16, flexShrink: 0 }} />
      <div className="flex-1 flex flex-col gap-2 py-1">
        <Skeleton style={{ height: 16, width: '70%' }} />
        <Skeleton style={{ height: 12, width: '45%' }} />
        <Skeleton style={{ height: 12, width: '55%' }} />
      </div>
    </div>
  )
}
