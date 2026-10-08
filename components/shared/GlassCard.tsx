'use client'
import { motion } from 'framer-motion'
import { ReactNode } from 'react'

interface GlassCardProps {
  children: ReactNode
  className?: string
  hover?: boolean
  onClick?: () => void
  padding?: string
  style?: React.CSSProperties
}

export default function GlassCard({
  children,
  className = '',
  hover = false,
  onClick,
  padding = 'p-6',
  style = {}
}: GlassCardProps) {
  const motionProps = hover ? {
    whileHover: { scale: 1.015 },
    whileTap: { scale: 0.98 },
    transition: { duration: 0.18 }
  } : {}

  return (
    <motion.div
      style={{
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(26px) saturate(1.6)',
        WebkitBackdropFilter: 'blur(26px) saturate(1.6)',
        border: '1px solid var(--glass-border)',
        borderRadius: '26px',
        boxShadow: 'var(--glass-shadow), inset 0 1px 0 var(--glass-highlight)',
        cursor: hover ? 'pointer' : 'default',
        ...style
      }}
      onClick={onClick}
      {...motionProps}
      className={`${padding} ${className}`}
    >
      {children}
    </motion.div>
  )
}
