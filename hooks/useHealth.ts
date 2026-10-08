import { useEffect, useState } from 'react'

export interface HealthInfo {
  ok?: boolean
  mock?: boolean
  aiDisabled?: boolean
  callsThisMonth?: number
}

/** One-shot GET /api/health — used to learn whether AI features are disabled. */
export function useHealth() {
  const [health, setHealth] = useState<HealthInfo | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/health', { headers: { Accept: 'application/json' } })
      .then(res => (res.ok ? res.json() : null))
      .then(data => { if (!cancelled && data) setHealth(data) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  return health
}
