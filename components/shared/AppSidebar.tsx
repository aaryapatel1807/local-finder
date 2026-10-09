'use client'
import Link from 'next/link'
import { motion, type Variants } from 'framer-motion'
import { ChevronRight, ChevronsLeft, Heart, History, ListChecks, MapPin, Users } from 'lucide-react'
import { usePathname } from 'next/navigation'
import useIsMobile from '../../hooks/useIsMobile'
import { useLanguage } from '../../hooks/useLanguage'

interface NavEntry {
  icon: React.ReactNode
  label: string
  href: string
  isActive?: boolean
}

const sidebarVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
}

const itemVariants: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { type: 'spring', stiffness: 100, damping: 15 },
  },
}

interface AppSidebarProps {
  mobileOpen?: boolean
  onNavigate?: () => void
  collapsed?: boolean
  onToggleCollapse?: () => void
}

export default function AppSidebar({ mobileOpen = false, onNavigate = () => {}, collapsed = false, onToggleCollapse = () => {} }: AppSidebarProps) {
  const pathname = usePathname()
  const isMobile = useIsMobile()
  const { t } = useLanguage()

  const icon = (C: any) => <C className="h-full w-full" />
  const navItems: NavEntry[] = [
    { icon: icon(MapPin), label: t('nav.home'), href: '/' },
    { icon: icon(Heart), label: t('nav.saved'), href: '/saved' },
    { icon: icon(ListChecks), label: t('nav.errands'), href: '/#errands' },
    { icon: icon(Users), label: t('nav.meet'), href: '/#meet' },
    { icon: icon(History), label: t('nav.recent'), href: '/#recent' },
  ].map(item => ({ ...item, isActive: pathname === item.href }))

  // Desktop: collapsing slides the sidebar off to the left, freeing the full
  // viewport for the dashboard. Mobile keeps its drawer behaviour.
  const sidebarHidden = isMobile ? !mobileOpen : collapsed

  return (
    <>
      {isMobile && mobileOpen && (
        <div
          onClick={onNavigate}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 99 }}
        />
      )}
      <div
        className="app-chrome"
        aria-hidden={sidebarHidden}
        style={{
          left: 0,
          top: 0,
          width: '260px',
          height: '100vh',
          zIndex: 100,
          display: 'flex',
          flexDirection: 'column',
          borderRight: '1px solid var(--glass-border)',
          transform: isMobile
            ? (mobileOpen ? 'translateX(0)' : 'translateX(-100%)')
            : (collapsed ? 'translateX(-105%)' : 'translateX(0)'),
          transition: 'transform 0.3s ease, visibility 0s linear',
          transitionDelay: sidebarHidden ? '0s, 0.3s' : '0s, 0s',
          visibility: sidebarHidden ? 'hidden' : 'visible',
        }}
      >
        {/* Collapse affordance straddling the sidebar edge (desktop only) */}
        {!isMobile && (
          <button
            onClick={onToggleCollapse}
            aria-label={t('nav.collapse')}
            title={t('nav.collapse')}
            tabIndex={sidebarHidden ? -1 : 0}
            style={{
              position: 'absolute',
              top: '72px',
              right: '-15px',
              width: '30px',
              height: '30px',
              borderRadius: '50%',
              background: 'var(--bg-primary)',
              border: '1px solid var(--glass-border)',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              zIndex: 101,
              boxShadow: '0 2px 10px rgba(0,0,0,0.10)',
              padding: 0,
            }}
          >
            <ChevronsLeft size={16} />
          </button>
        )}
        <motion.aside
          className="flex-1 min-h-0 w-full flex flex-col p-4 overflow-y-auto"
          initial="hidden"
          animate="visible"
          variants={sidebarVariants}
          aria-label={t('nav.navAria')}
        >
          {/* App wordmark (static — replaces the profile block slot) */}
          <motion.div variants={itemVariants} className="flex items-center space-x-3 p-2">
            <div
              aria-hidden
              style={{
                width: '44px', height: '44px', borderRadius: '50%',
                background: 'linear-gradient(135deg, #15B2CF, #7B61FF)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontWeight: 700, fontSize: '1rem', flexShrink: 0
              }}
            >
              LF
            </div>
            <div className="flex flex-col truncate">
              <span className="font-semibold text-lg" style={{ color: 'var(--text-primary)', fontFamily: "'Clash Display', sans-serif" }}>
                Local Finder
              </span>
              <span className="text-sm truncate" style={{ color: 'var(--text-muted)' }}>
                {t('nav.tagline')}
              </span>
            </div>
          </motion.div>

          <motion.div variants={itemVariants} className="my-4 border-t" style={{ borderColor: 'var(--border)' }} />

          {/* Navigation Links */}
          <nav className="flex-1 space-y-1" role="navigation">
            {navItems.map((item, index) => (
              <motion.div key={index} variants={itemVariants}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={item.isActive ? 'page' : undefined}
                  className={
                    'group flex items-center rounded-md px-3 py-2.5 text-sm font-medium transition-colors ' +
                    (item.isActive
                      ? 'bg-[rgba(21,178,207,0.12)] text-[var(--accent)]'
                      : 'hover:bg-[rgba(21,178,207,0.07)] hover:text-[var(--text-primary)]')
                  }
                  style={item.isActive ? {} : { color: 'var(--text-muted)' }}
                >
                  <span className="mr-3 h-5 w-5">{item.icon}</span>
                  <span>{item.label}</span>
                  <ChevronRight className="ml-auto h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
              </motion.div>
            ))}
          </nav>

          {/* Footer note */}
          <motion.div variants={itemVariants} className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.5, padding: '0 8px' }}>
              {t('nav.poweredBy')}
            </div>
          </motion.div>
        </motion.aside>
      </div>
    </>
  )
}
