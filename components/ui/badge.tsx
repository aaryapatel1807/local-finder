'use client'
import { ReactNode } from 'react'
import { cn } from './cn'

interface BadgeProps {
  children: ReactNode
  color?: string
  background?: string
  border?: string
  className?: string
}

/** Status badge — ALWAYS rendered with a text label, never color alone. */
export default function Badge({ children, color, background, border, className }: BadgeProps) {
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[0.72rem] font-semibold', className)}
      style={{ color, background, border: border ? `1px solid ${border}` : undefined }}
    >
      {children}
    </span>
  )
}
