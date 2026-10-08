'use client'
import { Bell, Menu, Sun, Moon, PanelLeftClose, PanelLeftOpen, MapPin } from 'lucide-react'
import useIsMobile from '../../hooks/useIsMobile'
import { useLanguage } from '../../hooks/useLanguage'
import LanguageSwitcher from '../LanguageSwitcher'
import { useTheme } from './ThemeContext'
import { useLocation } from './LocationContext'

/** Hour-bucketed greeting key — rendered through t() in the component. */
function greetingKey(hour: number): 'nav.morning' | 'nav.afternoon' | 'nav.evening' {
  if (hour < 12) return 'nav.morning'
  if (hour < 17) return 'nav.afternoon'
  return 'nav.evening'
}

interface NavbarProps {
  onMenuClick?: () => void
  collapsed?: boolean
  onToggleCollapse?: () => void
}

export default function Navbar({ onMenuClick = () => {}, collapsed = false, onToggleCollapse = () => {} }: NavbarProps) {
  const isMobile = useIsMobile()
  const { theme, toggleTheme } = useTheme()
  const { locationLabel, radiusKm } = useLocation()
  const { lang, setLang, t } = useLanguage()

  return (
    <div className="app-chrome app-chrome--merged" style={{
      top: 0,
      left: isMobile ? 0 : (collapsed ? 0 : '260px'),
      right: 0,
      height: isMobile ? '64px' : '80px',
      zIndex: 40,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: isMobile ? '0 12px' : '0 32px',
      transition: 'left 0.3s ease'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '8px' }}>
        {/* Left Side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          {isMobile && (
            <button
              onClick={onMenuClick}
              aria-label={t('nav.openMenu')}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                padding: '8px',
                display: 'flex',
                alignItems: 'center',
                flexShrink: 0
              }}
            >
              <Menu size={22} />
            </button>
          )}
          {!isMobile && (
            <button
              onClick={onToggleCollapse}
              aria-label={t(collapsed ? 'nav.expand' : 'nav.collapse')}
              title={t(collapsed ? 'nav.expand' : 'nav.collapse')}
              aria-expanded={!collapsed}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '8px',
                display: 'flex',
                alignItems: 'center',
                flexShrink: 0,
                borderRadius: '10px'
              }}
            >
              {collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
            </button>
          )}
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontFamily: "'Clash Display', sans-serif", fontSize: isMobile ? '0.95rem' : '1.2rem', color: 'var(--text-primary)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Local Finder 📍
            </h1>
            {!isMobile && (
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                {t(greetingKey(new Date().getHours()))} — {t('nav.subtitle')}
              </div>
            )}
          </div>
        </div>

        {/* Center: location pill */}
        <div
          aria-label={t('nav.locationAria', { label: locationLabel, radius: radiusKm })}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: isMobile ? '5px 10px' : '6px 14px',
            borderRadius: '99px',
            background: 'var(--glass-bg)',
            backdropFilter: 'blur(26px) saturate(1.6)',
            WebkitBackdropFilter: 'blur(26px) saturate(1.6)',
            border: '1px solid var(--glass-border)',
            boxShadow: 'var(--glass-shadow), inset 0 1px 0 var(--glass-highlight)',
            color: 'var(--text-primary)',
            fontSize: isMobile ? '0.72rem' : '0.82rem',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          <MapPin size={isMobile ? 12 : 14} style={{ color: 'var(--accent-deep)' }} />
          <span>{locationLabel} · {t('filters.radiusUnit', { n: radiusKm })}</span>
        </div>

        {/* Right Side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '16px' }}>
          {/* Language */}
          <LanguageSwitcher value={lang} onChange={setLang} />

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            aria-label={t(theme === 'light' ? 'nav.toDark' : 'nav.toLight')}
            title={t(theme === 'light' ? 'nav.themeDark' : 'nav.themeLight')}
            style={{
              background: 'var(--track)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
              borderRadius: '12px'
            }}
          >
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>

          {/* Bell Icon */}
          {!isMobile && (
            <button aria-label={t('nav.notifications')} style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '8px',
              display: 'flex',
              alignItems: 'center'
            }}>
              <Bell size={20} />
            </button>
          )}

          {/* Static app mark */}
          <div
            aria-hidden
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #15B2CF, #7B61FF)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid rgba(21,178,207,0.5)',
              color: '#fff',
              fontSize: '0.85rem',
              fontWeight: 700,
              flexShrink: 0
            }}
          >
            LF
          </div>
        </div>
      </div>
    </div>
  )
}
