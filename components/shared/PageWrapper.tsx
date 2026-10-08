'use client'
import { ReactNode } from 'react'
import useIsMobile from '../../hooks/useIsMobile'

export default function PageWrapper({ children, collapsed = false }: { children: ReactNode; collapsed?: boolean }) {
  const isMobile = useIsMobile()
  return (
    <div style={{
      paddingLeft: isMobile ? '0' : (collapsed ? '0' : '260px'), // Match Sidebar width
      paddingTop: isMobile ? '64px' : '80px',  // Match Navbar height
      minHeight: '100vh',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      zIndex: 1,
      background: 'var(--bg-primary)',
      boxSizing: 'border-box',
      transition: 'padding-left 0.3s ease',
    }}>
      <div style={{ padding: isMobile ? '16px' : '32px', flex: 1, width: '100%', maxWidth: '1600px', margin: '0 auto', boxSizing: 'border-box' }}>
        {children}
      </div>
    </div>
  )
}
