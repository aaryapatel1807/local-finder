'use client'
import { SelectHTMLAttributes } from 'react'
import { cn } from './cn'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {}

/** Native select styled on the glass theme. */
export default function Select({ className, children, ...props }: SelectProps) {
  return (
    <select
      {...props}
      className={cn(
        'rounded-xl px-3 py-2.5 text-sm font-medium cursor-pointer bg-[var(--input-bg)] border border-[var(--input-border)]',
        'text-[var(--text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
        className
      )}
    >
      {children}
    </select>
  )
}
