'use client'
import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

/**
 * Collapsible accordion section — collapsed by default so search results
 * stay above the fold. Used for Errand planner and Meet in the middle.
 */
export default function Accordion({
  title,
  icon,
  children,
  defaultOpen = false,
  id,
}: {
  title: string
  icon?: ReactNode
  children: ReactNode
  defaultOpen?: boolean
  id?: string
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div
      id={id}
      style={{
        scrollMarginTop: '90px',
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(26px) saturate(1.6)',
        WebkitBackdropFilter: 'blur(26px) saturate(1.6)',
        border: '1px solid var(--glass-border)',
        borderRadius: '18px',
        boxShadow: 'var(--glass-shadow)',
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '14px 18px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-primary)',
          fontSize: '0.95rem',
          fontWeight: 700,
          fontFamily: "'Satoshi', sans-serif",
          textAlign: 'left',
        }}
      >
        {icon}
        <span style={{ flex: 1 }}>{title}</span>
        <ChevronDown
          size={18}
          style={{
            color: 'var(--text-muted)',
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.2s ease',
          }}
          aria-hidden
        />
      </button>
      {open && <div style={{ padding: '0 18px 18px' }}>{children}</div>}
    </div>
  )
}
