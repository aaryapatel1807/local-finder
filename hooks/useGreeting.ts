'use client'
import { useEffect, useState } from 'react'
import { greetingKey } from '../lib/greeting'
import { useLanguage } from './useLanguage'

/**
 * Time-aware greeting string, e.g. "Good Evening" (localized via the dictionary).
 * The hour is read on mount so server and client renders never disagree.
 */
export function useGreeting(): { greeting: string } {
  const { t } = useLanguage()
  const [hour, setHour] = useState<number | null>(null)

  useEffect(() => {
    setHour(new Date().getHours())
  }, [])

  return { greeting: hour === null ? '' : t(greetingKey(hour)) }
}
