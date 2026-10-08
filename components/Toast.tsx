'use client'
import { useEffect, useState } from 'react'

/** Small bottom toast for transient confirmations ("Link copied"). */
export default function Toast({ message }: { message: string | null }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!message) return
    setVisible(true)
    const t = setTimeout(() => setVisible(false), 2200)
    return () => clearTimeout(t)
  }, [message])

  if (!message) return null

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: '28px',
        left: '50%',
        transform: `translateX(-50%) translateY(${visible ? '0' : '12px'})`,
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.25s ease, transform 0.25s ease',
        zIndex: 200,
        padding: '10px 20px',
        borderRadius: '99px',
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(26px) saturate(1.6)',
        WebkitBackdropFilter: 'blur(26px) saturate(1.6)',
        border: '1px solid var(--glass-border)',
        boxShadow: 'var(--glass-shadow), inset 0 1px 0 var(--glass-highlight)',
        color: 'var(--text-primary)',
        fontSize: '0.85rem',
        fontWeight: 600,
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      {message}
    </div>
  )
}
