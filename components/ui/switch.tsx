'use client'
import { KeyboardEvent } from 'react'
import { cn } from './cn'

interface SwitchProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  label?: string
  id?: string
}

/** Accessible toggle switch (role="switch", keyboard operable). */
export default function Switch({ checked, onCheckedChange, label, id }: SwitchProps) {
  const handleKey = (e: KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      onCheckedChange(!checked)
    }
  }

  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={label}
      tabIndex={0}
      onClick={() => onCheckedChange(!checked)}
      onKeyDown={handleKey}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border transition-colors duration-200',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2'
      )}
      style={{
        background: checked ? 'var(--accent)' : 'var(--track)',
        borderColor: checked ? 'var(--accent)' : 'var(--border)',
      }}
    >
      <span
        aria-hidden
        className="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200"
        style={{ translate: checked ? '22px 0' : '2px 0' }}
      />
    </button>
  )
}
