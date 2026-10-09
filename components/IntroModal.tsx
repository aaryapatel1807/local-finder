'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  MapPin,
  Navigation,
  Search,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useLanguage } from '../hooks/useLanguage'

export interface IntroModalProps {
  open: boolean
  onClose: () => void
}

interface Step {
  titleKey: string
  bodyKey: string
  Icon: LucideIcon
}

const STEPS: Step[] = [
  { titleKey: 'intro.step1.title', bodyKey: 'intro.step1.body', Icon: Search },
  { titleKey: 'intro.step2.title', bodyKey: 'intro.step2.body', Icon: MapPin },
  { titleKey: 'intro.step3.title', bodyKey: 'intro.step3.body', Icon: Navigation },
]

const STEP_TRANSITION = 'opacity 200ms ease-out, transform 200ms ease-out'
const FONT = "'Satoshi', sans-serif"

/**
 * First-visit 3-step intro modal, reskinned to the app's glass system.
 * Steps/titles/bodies/skip/next/back/start/close-label all via t().
 * A11y: role=dialog aria-modal, aria-labelledby, Escape closes, heading
 * focused on open/step change, body scroll locked, click-outside closes.
 */
export default function IntroModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useLanguage()
  const [step, setStep] = useState(0)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const lastStep = STEPS.length - 1

  const goNext = useCallback(() => setStep((s) => Math.min(s + 1, lastStep)), [lastStep])
  const goBack = useCallback(() => setStep((s) => Math.max(s - 1, 0)), [])

  // Reset to the first step whenever the modal is (re)opened.
  useEffect(() => {
    if (open) {
      setStep(0)
    }
  }, [open])

  // Focus the heading on open (and again as steps change) for screen readers.
  useEffect(() => {
    if (open) {
      headingRef.current?.focus()
    }
  }, [open, step])

  // Escape closes.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Lock body scroll while the modal is up.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="intro-modal-title"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        background: 'rgba(10, 14, 20, 0.6)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 400,
          borderRadius: 22,
          border: '1px solid var(--glass-border)',
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(26px) saturate(1.6)',
          WebkitBackdropFilter: 'blur(26px) saturate(1.6)',
          color: 'var(--text-primary)',
          fontFamily: FONT,
          padding: '28px 24px 20px',
          boxShadow: 'var(--glass-shadow)',
        }}
      >
        {/* X — close */}
        <button
          type="button"
          onClick={onClose}
          aria-label={t('intro.closeAria')}
          className="transition-transform duration-150 ease-out active:scale-95"
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 34,
            height: 34,
            borderRadius: '50%',
            border: '1px solid var(--glass-border)',
            background: 'transparent',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            fontFamily: FONT,
          }}
        >
          <X size={16} aria-hidden />
        </button>

        {/* Steps — crossfade, 200ms ease-out */}
        <div style={{ position: 'relative', minHeight: 190 }}>
          {STEPS.map((s, i) => {
            const active = i === step
            const StepIcon = s.Icon
            return (
              <div
                key={s.titleKey}
                aria-hidden={!active}
                style={{
                  position: i === 0 ? 'relative' : 'absolute',
                  inset: i === 0 ? undefined : 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  opacity: active ? 1 : 0,
                  transform: active ? 'translateY(0)' : `translateY(${i < step ? -10 : 10}px)`,
                  transition: STEP_TRANSITION,
                  pointerEvents: active ? 'auto' : 'none',
                }}
              >
                <span
                  aria-hidden
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 60,
                    height: 60,
                    borderRadius: '50%',
                    background: 'var(--accent)',
                    color: '#fff',
                    marginBottom: 16,
                  }}
                >
                  <StepIcon size={28} />
                </span>
                <h2
                  id={i === 0 ? 'intro-modal-title' : undefined}
                  ref={i === step ? headingRef : undefined}
                  tabIndex={-1}
                  style={{
                    margin: 0,
                    fontSize: '1.25rem',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    fontFamily: FONT,
                    outline: 'none',
                  }}
                >
                  {t(s.titleKey)}
                </h2>
                <p
                  style={{
                    margin: '10px 0 0',
                    fontSize: '0.92rem',
                    lineHeight: 1.6,
                    color: 'var(--text-muted)',
                    maxWidth: 300,
                  }}
                >
                  {t(s.bodyKey)}
                </p>
              </div>
            )
          })}
        </div>

        {/* Progress dots */}
        <div
          role="presentation"
          style={{ display: 'flex', justifyContent: 'center', gap: 8, margin: '18px 0 16px' }}
        >
          {STEPS.map((s, i) => (
            <span
              key={s.titleKey}
              aria-hidden
              style={{
                width: i === step ? 22 : 8,
                height: 8,
                borderRadius: 999,
                background: i === step ? 'var(--accent)' : 'var(--glass-border)',
                transition: STEP_TRANSITION,
              }}
            />
          ))}
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <button
            type="button"
            onClick={goBack}
            disabled={step === 0}
            aria-label={t('intro.back')}
            className="transition-transform duration-150 ease-out active:scale-95"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '10px 14px',
              borderRadius: 12,
              border: '1px solid var(--glass-border)',
              background: 'transparent',
              color: 'var(--text-primary)',
              fontSize: '0.88rem',
              fontWeight: 600,
              fontFamily: FONT,
              cursor: step === 0 ? 'default' : 'pointer',
              opacity: step === 0 ? 0.35 : 1,
            }}
          >
            <ChevronLeft size={16} aria-hidden />
            {t('intro.back')}
          </button>

          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '10px 8px',
              border: 'none',
              background: 'transparent',
              color: 'var(--text-muted)',
              fontSize: '0.88rem',
              fontWeight: 500,
              fontFamily: FONT,
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            {t('intro.skip')}
          </button>

          {step === lastStep ? (
            <button
              type="button"
              onClick={onClose}
              className="transition-transform duration-150 ease-out active:scale-95"
              style={{
                padding: '10px 22px',
                borderRadius: 12,
                border: 'none',
                background: 'var(--accent)',
                color: '#fff',
                fontSize: '0.88rem',
                fontWeight: 700,
                fontFamily: FONT,
                cursor: 'pointer',
              }}
            >
              {t('intro.start')}
            </button>
          ) : (
            <button
              type="button"
              onClick={goNext}
              aria-label={t('intro.next')}
              className="transition-transform duration-150 ease-out active:scale-95"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '10px 18px',
                borderRadius: 12,
                border: 'none',
                background: 'var(--accent)',
                color: '#fff',
                fontSize: '0.88rem',
                fontWeight: 700,
                fontFamily: FONT,
                cursor: 'pointer',
              }}
            >
              {t('intro.next')}
              <ChevronRight size={16} aria-hidden />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
