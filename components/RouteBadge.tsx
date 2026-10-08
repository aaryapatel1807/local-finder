'use client'
import { Car, Footprints } from 'lucide-react'
import Badge from './ui/badge'
import type { RouteInfo, RouteMode } from '../hooks/useRouteTime'
import { useLanguage } from '../hooks/useLanguage'

interface RouteBadgeProps {
  /** Route entry from useRouteTime — hidden while null/undefined. */
  route?: RouteInfo | null
  mode?: RouteMode
}

/** Travel-time pill, e.g. "12 min walk" / "8 min drive".
 *  Shows a "~" prefix when the server fell back to an estimate. */
export default function RouteBadge({ route, mode = 'walk' }: RouteBadgeProps) {
  const { t } = useLanguage()
  if (!route || !Number.isFinite(route.durationMin)) return null
  const mins = Math.max(1, Math.round(route.durationMin))
  const Icon = mode === 'walk' ? Footprints : Car
  return (
    <Badge
      color="var(--text-faint)"
      background="rgba(21,178,207,0.10)"
      border="rgba(21,178,207,0.28)"
    >
      <Icon size={12} aria-hidden />
      {route.estimated ? '~' : ''}{t(mode === 'walk' ? 'route.walk' : 'route.drive', { mins })}
    </Badge>
  )
}
