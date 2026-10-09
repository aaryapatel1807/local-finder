import { describe, expect, it } from 'vitest'
import { greetingKey } from './greeting'

describe('greetingKey', () => {
  it('returns night for the small hours (< 5)', () => {
    expect(greetingKey(0)).toBe('nav.night')
    expect(greetingKey(4)).toBe('nav.night')
  })

  it('returns morning for 5–11', () => {
    expect(greetingKey(5)).toBe('nav.morning')
    expect(greetingKey(11)).toBe('nav.morning')
  })

  it('returns afternoon for 12–16', () => {
    expect(greetingKey(12)).toBe('nav.afternoon')
    expect(greetingKey(16)).toBe('nav.afternoon')
  })

  it('returns evening for 17–21', () => {
    expect(greetingKey(17)).toBe('nav.evening')
    expect(greetingKey(21)).toBe('nav.evening')
  })

  it('returns night again for 22–23', () => {
    expect(greetingKey(22)).toBe('nav.night')
    expect(greetingKey(23)).toBe('nav.night')
  })
})
