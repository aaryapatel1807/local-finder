/**
 * Pure hour → greeting dictionary key mapping.
 * Buckets: <5 night, <12 morning, <17 afternoon, <22 evening, else night.
 */

export type GreetingKey = 'nav.night' | 'nav.morning' | 'nav.afternoon' | 'nav.evening'

/** Hour-bucketed greeting key — rendered through t() by the caller. */
export function greetingKey(hour: number): GreetingKey {
  if (hour < 5) return 'nav.night'
  if (hour < 12) return 'nav.morning'
  if (hour < 17) return 'nav.afternoon'
  if (hour < 22) return 'nav.evening'
  return 'nav.night'
}
