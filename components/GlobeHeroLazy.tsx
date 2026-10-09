'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'

/**
 * GlobeHeroLazy — the public <GlobeHero/> the coordinator drops into the
 * empty home state.
 *
 * The 3D bundle (three + @react-three/fiber) is loaded ONLY when the device
 * and user preferences allow it. BEFORE any of that code loads we check:
 *   - prefers-reduced-motion            → static SVG fallback
 *   - navigator.connection effectiveType '2g' / 'slow-2g' → static fallback
 *   - navigator.deviceMemory <= 2 GB    → static fallback
 * Otherwise we next/dynamic-import ./GlobeHero with ssr:false.
 */

const R3DGlobeHero = dynamic(() => import('./GlobeHero'), {
  ssr: false,
  loading: () => <StaticGlobeFallback />,
})

const ACCENT = '#15B2CF' // app accent — replaces the trial's orange/purple pin

type Mode = 'pending' | 'globe' | 'static'

function shouldUseStatic(): { lite: boolean; reducedMotion: boolean } {
  const nav = navigator as Navigator & {
    connection?: { effectiveType?: string }
    deviceMemory?: number
  }
  const reducedMotion =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const effectiveType = nav.connection?.effectiveType
  const slowNetwork = effectiveType === '2g' || effectiveType === 'slow-2g'
  const lowMemory =
    typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 2
  return { lite: reducedMotion || slowNetwork || lowMemory, reducedMotion }
}

function GlobePulseStyles() {
  return (
    <style>{`
      @keyframes globe-fallback-pulse {
        0%   { transform: scale(0.6); opacity: 0.85; }
        70%  { transform: scale(2.1); opacity: 0; }
        100% { transform: scale(2.1); opacity: 0; }
      }
      .globe-fallback-pulse {
        transform-box: fill-box;
        transform-origin: center;
        animation: globe-fallback-pulse 2.6s ease-out infinite;
      }
    `}</style>
  )
}

/**
 * StaticGlobeFallback — inline SVG stand-in: dark teal circle with meridian
 * + latitude lines and an accent-colored map pin. Optional gentle CSS pulse
 * on the base ring (only when `pulse` is true; never under reduced motion).
 */
export function StaticGlobeFallback({ pulse = false }: { pulse?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none flex w-full select-none items-center justify-center"
      style={{ height: 260 }}
    >
      {pulse && <GlobePulseStyles />}
      <svg width="400" height="260" viewBox="0 0 400 260" role="img">
        {/* Globe body */}
        <circle cx="200" cy="132" r="78" fill="#0d3a44" opacity="0.92" />
        <circle cx="200" cy="132" r="78" fill="none" stroke="#2dd4bf" strokeOpacity="0.55" strokeWidth="1.5" />
        {/* Meridians */}
        <ellipse cx="200" cy="132" rx="52" ry="78" fill="none" stroke="#2dd4bf" strokeOpacity="0.32" strokeWidth="1" />
        <ellipse cx="200" cy="132" rx="26" ry="78" fill="none" stroke="#2dd4bf" strokeOpacity="0.32" strokeWidth="1" />
        {/* Latitudes */}
        <ellipse cx="200" cy="132" rx="68" ry="26" fill="none" stroke="#2dd4bf" strokeOpacity="0.28" strokeWidth="1" />
        <ellipse cx="200" cy="132" rx="68" ry="52" fill="none" stroke="#2dd4bf" strokeOpacity="0.28" strokeWidth="1" />
        <line x1="122" y1="132" x2="278" y2="132" stroke="#2dd4bf" strokeOpacity="0.28" strokeWidth="1" />
        {/* Pin: accent teardrop + head, tip resting on the globe */}
        <path
          d="M200 22 C 187 22 178 33 178 44 C 178 59 200 80 200 80 C 200 80 222 59 222 44 C 222 33 213 22 200 22 Z"
          fill={ACCENT}
        />
        <circle cx="200" cy="44" r="8.5" fill={ACCENT} />
        {/* Base ring — gentle pulse only when allowed */}
        {pulse ? (
          <circle
            className="globe-fallback-pulse"
            cx="200"
            cy="80"
            r="11"
            fill="none"
            stroke={ACCENT}
            strokeWidth="2"
          />
        ) : (
          <circle cx="200" cy="80" r="11" fill="none" stroke={ACCENT} strokeOpacity="0.6" strokeWidth="2" />
        )}
      </svg>
    </div>
  )
}

export function GlobeHero() {
  // Start on the static fallback (matches SSR HTML, so no hydration mismatch),
  // then decide on the client whether to load the 3D bundle.
  const [mode, setMode] = useState<Mode>('pending')
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const { lite, reducedMotion: rm } = shouldUseStatic()
    setReducedMotion(rm)
    setMode(lite ? 'static' : 'globe')
  }, [])

  if (mode === 'globe') return <R3DGlobeHero />
  return <StaticGlobeFallback pulse={!reducedMotion} />
}

export default GlobeHero
