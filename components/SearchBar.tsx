'use client'
import { FormEvent, useEffect, useRef, useState } from 'react'
import { Mic, Search, Sparkles, X } from 'lucide-react'
import Button from './ui/button'

/** Minimal structural type for the Web Speech API recognition object. */
interface WebkitSpeechRecognitionLike {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
  start: () => void
  stop: () => void
}

interface SearchBarProps {
  value: string
  onChange: (v: string) => void
  onSubmit: (q: string) => void
  /** Hide the AI parse button when the server reports aiDisabled. */
  aiDisabled?: boolean
  onParse?: (text: string) => void
  parsing?: boolean
  recentSearches: string[]
  onRecentSelect: (q: string) => void
}

/**
 * Glass search bar. Submits on Enter or the Go button only — never on
 * keystroke (saves SerpApi calls). Recent searches as small pills below.
 */
export default function SearchBar({
  value, onChange, onSubmit, aiDisabled, onParse, parsing, recentSearches, onRecentSelect,
}: SearchBarProps) {
  const [focused, setFocused] = useState(false)
  const [listening, setListening] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(false)
  const recogRef = useRef<{ stop: () => void } | null>(null)

  // Web Speech API — feature-detect on mount (SSR-safe).
  useEffect(() => {
    const SR = (window as unknown as {
      SpeechRecognition?: new () => WebkitSpeechRecognitionLike
      webkitSpeechRecognition?: new () => WebkitSpeechRecognitionLike
    }).SpeechRecognition ?? (window as unknown as {
      webkitSpeechRecognition?: new () => WebkitSpeechRecognitionLike
    }).webkitSpeechRecognition
    setSpeechSupported(!!SR)
    return () => { recogRef.current?.stop() }
  }, [])

  const toggleListening = () => {
    if (listening) {
      recogRef.current?.stop()
      return
    }
    const w = window as unknown as {
      SpeechRecognition?: new () => WebkitSpeechRecognitionLike
      webkitSpeechRecognition?: new () => WebkitSpeechRecognitionLike
    }
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition
    if (!SR) return
    const recog = new SR()
    recog.lang = 'en-IN'
    recog.interimResults = false
    recog.maxAlternatives = 1
    recog.onresult = (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => {
      const transcript = e.results[0]?.[0]?.transcript
      if (transcript) onChange(transcript) // into the input only — no auto-submit
    }
    recog.onend = () => {
      setListening(false)
      recogRef.current = null
    }
    recog.onerror = () => {
      setListening(false)
      recogRef.current = null
    }
    recogRef.current = recog
    try {
      recog.start()
      setListening(true)
    } catch {
      setListening(false)
      recogRef.current = null
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const q = value.trim()
    if (q) onSubmit(q)
  }

  return (
    <div>
      <form
        onSubmit={submit}
        role="search"
        aria-label="Search places"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(26px) saturate(1.6)',
          WebkitBackdropFilter: 'blur(26px) saturate(1.6)',
          border: `1px solid ${focused ? 'var(--accent)' : 'var(--glass-border)'}`,
          borderRadius: '26px',
          boxShadow: 'var(--glass-shadow), inset 0 1px 0 var(--glass-highlight)',
          padding: '6px 6px 6px 16px',
          transition: 'border-color 0.2s ease',
        }}
      >
        <Search size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} aria-hidden />
        <input
          type="search"
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Search places — e.g. pharmacy, chai…"
          aria-label="Search places"
          enterKeyHint="search"
          style={{
            flex: 1,
            minWidth: 0,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--text-primary)',
            fontSize: '0.95rem',
            fontFamily: "'Satoshi', sans-serif",
            padding: '10px 0',
          }}
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label="Clear search"
            style={{
              background: 'var(--track)',
              border: 'none',
              borderRadius: '50%',
              width: 28, height: 28,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0,
            }}
          >
            <X size={15} />
          </button>
        )}
        {speechSupported && (
          <button
            type="button"
            onClick={toggleListening}
            aria-label={listening ? 'Stop voice input' : 'Search by voice'}
            aria-pressed={listening}
            title="Search by voice"
            style={{
              background: listening ? 'rgba(217,119,6,0.18)' : 'transparent',
              border: 'none',
              borderRadius: '50%',
              width: 36, height: 36,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: listening ? '#D97706' : 'var(--text-muted)',
              cursor: 'pointer', flexShrink: 0,
            }}
          >
            <Mic size={17} className={listening ? 'animate-pulse' : undefined} />
          </button>
        )}
        {!aiDisabled && onParse && (
          <button
            type="button"
            onClick={() => value.trim() && onParse(value.trim())}
            disabled={!value.trim() || parsing}
            aria-label="Parse with AI"
            title="Understand my query with AI"
            style={{
              background: 'transparent',
              border: 'none',
              borderRadius: '50%',
              width: 36, height: 36,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--accent-purple)', cursor: 'pointer', flexShrink: 0,
              opacity: !value.trim() || parsing ? 0.4 : 1,
            }}
          >
            <Sparkles size={17} className={parsing ? 'animate-pulse' : undefined} />
          </button>
        )}
        <Button
          type="submit"
          variant="primary"
          disabled={!value.trim()}
          style={{ borderRadius: '20px', padding: '10px 20px' }}
        >
          Go
        </Button>
      </form>

      {recentSearches.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }} aria-label="Recent searches">
          {recentSearches.map(q => (
            <button
              key={q}
              type="button"
              onClick={() => onRecentSelect(q)}
              className="chip chip-muted"
              style={{ cursor: 'pointer', fontFamily: "'Satoshi', sans-serif" }}
            >
              {q}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
