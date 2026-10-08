'use client'
import { ButtonHTMLAttributes } from 'react'
import { cn } from './cn'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'icon'
}

/** Minimal shadcn-style button on the glass theme. */
export default function Button({ variant = 'ghost', className, children, ...props }: ButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-2 font-semibold cursor-pointer transition-all duration-200 ' +
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 ' +
    'disabled:opacity-50 disabled:cursor-not-allowed'
  const variants: Record<string, string> = {
    primary:
      'text-white rounded-xl px-5 py-3 text-sm hover:scale-[1.02] active:scale-[0.98] ' +
      'bg-[linear-gradient(135deg,#FF6B5E,#FFB020_55%,#7B61FF)] shadow-[0_4px_16px_rgba(255,107,94,0.35)]',
    ghost:
      'rounded-xl px-4 py-2.5 text-sm bg-[var(--bg-card)] border border-[var(--border)] ' +
      'text-[var(--text-primary)] hover:border-[var(--accent)]',
    icon:
      'rounded-xl p-2.5 text-sm bg-[var(--track)] border border-[var(--border)] ' +
      'text-[var(--text-primary)] hover:border-[var(--accent)]',
  }
  return (
    <button className={cn(base, variants[variant], className)} {...props}>
      {children}
    </button>
  )
}
