'use client'
import { motion } from 'framer-motion'

/**
 * ScenicBackdrop — the dashboard's frosted scenic backdrop, shared by every page.
 * Blurred scenic image + theme veil + two drifting orbs. Theme-aware via CSS vars
 * (--dash-veil, --dash-orb-1, --dash-orb-2) so light and dark mode match the dashboard.
 *
 * Usage: render as the FIRST child of the page's root element, and give that root
 * `position: 'relative', zIndex: 1` with a transparent background. The fixed
 * backdrop then sits behind the page content.
 */
export default function ScenicBackdrop() {
  return (
    <div aria-hidden style={{ position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      <img src="/images/dash-bg.jpg" alt=""
        style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(46px) saturate(1.25)', transform: 'scale(1.12)' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'var(--dash-veil)' }} />
      <motion.div
        animate={{ x: [0, 46, 0], y: [0, -34, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
        style={{ position: 'absolute', top: '-10%', left: '-8%', width: '44vw', height: '44vw',
          borderRadius: '50%', background: 'var(--dash-orb-1)', filter: 'blur(70px)' }} />
      <motion.div
        animate={{ x: [0, -54, 0], y: [0, 40, 0] }}
        transition={{ duration: 23, repeat: Infinity, ease: 'easeInOut' }}
        style={{ position: 'absolute', bottom: '-16%', right: '-10%', width: '50vw', height: '50vw',
          borderRadius: '50%', background: 'var(--dash-orb-2)', filter: 'blur(80px)' }} />
    </div>
  )
}
