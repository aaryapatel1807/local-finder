import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { hasSeenIntro, markIntroSeen } from './introSeen'

/** Minimal in-memory localStorage double. */
function makeStorage() {
  const store = new Map<string, string>()
  return {
    getItem: (k: string): string | null => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string): void => {
      store.set(k, v)
    },
    removeItem: (k: string): void => {
      store.delete(k)
    },
    clear: (): void => store.clear(),
  }
}

type StorageDouble = ReturnType<typeof makeStorage>

describe('introSeen', () => {
  let storage: StorageDouble

  beforeEach(() => {
    storage = makeStorage()
    ;(globalThis as Record<string, unknown>).window = { localStorage: storage }
  })

  afterEach(() => {
    delete (globalThis as Record<string, unknown>).window
  })

  it('reports false before the intro is marked', () => {
    expect(hasSeenIntro()).toBe(false)
  })

  it('reports true after markIntroSeen()', () => {
    markIntroSeen()
    expect(hasSeenIntro()).toBe(true)
  })

  it('writes the expected storage key', () => {
    markIntroSeen()
    expect(storage.getItem('localfinder_intro_seen')).toBe('1')
  })

  it('stays marked across calls', () => {
    markIntroSeen()
    markIntroSeen()
    expect(hasSeenIntro()).toBe(true)
  })

  describe('when storage is unavailable', () => {
    beforeEach(() => {
      delete (globalThis as Record<string, unknown>).window
    })

    it('hasSeenIntro() returns false instead of throwing', () => {
      expect(() => hasSeenIntro()).not.toThrow()
      expect(hasSeenIntro()).toBe(false)
    })

    it('markIntroSeen() does not throw', () => {
      expect(() => markIntroSeen()).not.toThrow()
    })
  })
})
