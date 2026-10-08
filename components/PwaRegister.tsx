'use client'
import { useEffect } from 'react'

/** Registers the service worker in production builds only. */
export default function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return
    try {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    } catch {
      // Service workers unsupported or blocked — app works without one.
    }
  }, [])
  return null
}
