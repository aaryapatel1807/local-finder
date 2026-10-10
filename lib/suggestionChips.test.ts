import { describe, expect, it } from 'vitest'
import { slotForHour } from './suggestions'
import { STRINGS } from './i18n/dictionary'

describe('slotForHour', () => {
  it('picks the morning slot for 5–10', () => {
    expect(slotForHour(5).headingKey).toBe('suggest.morningHeading')
    expect(slotForHour(10).headingKey).toBe('suggest.morningHeading')
  })

  it('picks the afternoon slot for 11–15', () => {
    expect(slotForHour(11).headingKey).toBe('suggest.afternoonHeading')
    expect(slotForHour(15).headingKey).toBe('suggest.afternoonHeading')
  })

  it('picks the evening slot for 16–21', () => {
    expect(slotForHour(16).headingKey).toBe('suggest.eveningHeading')
    expect(slotForHour(21).headingKey).toBe('suggest.eveningHeading')
  })

  it('picks the night slot otherwise (0–4, 22–23)', () => {
    for (const hour of [0, 2, 4, 22, 23]) {
      expect(slotForHour(hour).headingKey, `hour ${hour}`).toBe('suggest.nightHeading')
    }
  })

  it('gives every slot exactly three chips', () => {
    for (const hour of [6, 13, 19, 3]) {
      expect(slotForHour(hour).chips).toHaveLength(3)
    }
  })

  it('keeps chip queries in English', () => {
    expect(slotForHour(6).chips[0].query).toBe('bakery near me')
    expect(slotForHour(12).chips[1].query).toBe('cafe near me')
    expect(slotForHour(20).chips[2].query).toBe('chaat near me')
    expect(slotForHour(23).chips[0].query).toBe('24 hour pharmacy near me')
  })

  it('uses heading and label keys that exist in the dictionary', () => {
    for (const hour of [6, 12, 18, 23]) {
      const slot = slotForHour(hour)
      expect(STRINGS.en[slot.headingKey], slot.headingKey).toBeDefined()
      for (const chip of slot.chips) {
        expect(STRINGS.en[chip.labelKey], chip.labelKey).toBeDefined()
      }
    }
  })
})
