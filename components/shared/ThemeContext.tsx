'use client'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

interface ThemeCtx {
  theme: 'light' | 'dark'
  toggleTheme: () => void
  setTheme: (t: 'light' | 'dark') => void
}

const ThemeContext = createContext<ThemeCtx>({ theme: 'light', toggleTheme: () => {}, setTheme: () => {} })
const STORAGE_KEY = 'localfinder_theme'

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<'light' | 'dark'>(() => {
    if (typeof document === 'undefined') return 'light'
    const t = document.documentElement.dataset.theme
    if (t === 'dark' || t === 'light') return t
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved === 'dark' || saved === 'light') {
        setThemeState(saved)
        document.documentElement.dataset.theme = saved
      }
    } catch {}
  }, [])

  const setTheme = (t: 'light' | 'dark') => {
    setThemeState(t)
    document.documentElement.dataset.theme = t
    try { localStorage.setItem(STORAGE_KEY, t) } catch {}
  }
  const toggleTheme = () => setTheme(theme === 'light' ? 'dark' : 'light')

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
