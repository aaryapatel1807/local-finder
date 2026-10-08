'use client'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import AppSidebar from './AppSidebar'
import Navbar from './Navbar'
import PageWrapper from './PageWrapper'
import { ThemeProvider } from './ThemeContext'
import { LocationProvider } from './LocationContext'
import useIsMobile from '../../hooks/useIsMobile'

const SIDEBAR_COLLAPSED_KEY = 'localfinder_sidebar_collapsed'

/** Exposes the chrome state (sidebar collapsed / mobile) to page content,
 *  e.g. so the details sheet can sit beside the sidebar like NutriAI's overlays. */
const ShellContext = createContext({ collapsed: false, isMobile: false })
export function useShell() {
  return useContext(ShellContext)
}

function ShellInner({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // Restore the user's sidebar preference (desktop collapse)
  useEffect(() => {
    try {
      if (localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1') setSidebarCollapsed(true)
    } catch {}
  }, [])

  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed(prev => {
      const next = !prev
      try { localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0') } catch {}
      return next
    })
  }

  return (
    <ShellContext.Provider value={{ collapsed: sidebarCollapsed, isMobile }}>
      <AppSidebar
        mobileOpen={sidebarOpen}
        onNavigate={() => setSidebarOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={toggleSidebarCollapsed}
      />
      <Navbar
        onMenuClick={() => setSidebarOpen(open => !open)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={toggleSidebarCollapsed}
      />
      <PageWrapper collapsed={sidebarCollapsed}>
        {children}
      </PageWrapper>
    </ShellContext.Provider>
  )
}

export default function LayoutShell({ children }: { children: ReactNode }) {
  // Every route in this app uses the dashboard chrome — no login wall.
  return (
    <ThemeProvider>
      <LocationProvider>
        <ShellInner>{children}</ShellInner>
      </LocationProvider>
    </ThemeProvider>
  )
}
