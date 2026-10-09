/**
 * Pure time-of-day → suggestion-slot mapping.
 *
 * Separated from components/SuggestionChips.tsx so the logic is unit-testable
 * in the node vitest environment (the component file contains JSX).
 * Labels are dictionary keys resolved via t(); queries stay English.
 */

import {
  Clock,
  Coffee,
  Croissant,
  Fuel,
  Hospital,
  Moon,
  Pill,
  ShoppingCart,
  Sunrise,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react'

export interface SuggestionChipDef {
  labelKey: string
  /** Always English — a ready-to-run search query. */
  query: string
  Icon: LucideIcon
}

export interface SuggestionSlot {
  headingKey: string
  HeadingIcon: LucideIcon
  chips: SuggestionChipDef[]
}

/**
 * Pure time-of-day → suggestion slot.
 * 5–11 morning, 11–16 afternoon, 16–22 evening, everything else night.
 */
export function slotForHour(hour: number): SuggestionSlot {
  if (hour >= 5 && hour < 11) {
    return {
      headingKey: 'suggest.morningHeading',
      HeadingIcon: Sunrise,
      chips: [
        { labelKey: 'suggest.morningChai', query: 'chai near me', Icon: Coffee },
        { labelKey: 'suggest.bakery', query: 'bakery near me', Icon: Croissant },
        { labelKey: 'suggest.breakfast', query: 'breakfast near me', Icon: UtensilsCrossed },
      ],
    }
  }
  if (hour >= 11 && hour < 16) {
    return {
      headingKey: 'suggest.afternoonHeading',
      HeadingIcon: UtensilsCrossed,
      chips: [
        { labelKey: 'suggest.lunch', query: 'lunch near me', Icon: UtensilsCrossed },
        { labelKey: 'suggest.coffee', query: 'cafe near me', Icon: Coffee },
        { labelKey: 'suggest.dessert', query: 'dessert near me', Icon: Croissant },
      ],
    }
  }
  if (hour >= 16 && hour < 22) {
    return {
      headingKey: 'suggest.eveningHeading',
      HeadingIcon: Clock,
      chips: [
        { labelKey: 'suggest.dinner', query: 'dinner near me', Icon: UtensilsCrossed },
        { labelKey: 'suggest.groceries', query: 'grocery store near me', Icon: ShoppingCart },
        { labelKey: 'suggest.pharmacy', query: 'pharmacy near me', Icon: Pill },
      ],
    }
  }
  return {
    headingKey: 'suggest.nightHeading',
    HeadingIcon: Moon,
    chips: [
      { labelKey: 'suggest.nightPharmacy', query: '24 hour pharmacy near me', Icon: Pill },
      { labelKey: 'suggest.hospital', query: 'hospital near me', Icon: Hospital },
      { labelKey: 'suggest.petrol', query: 'petrol pump near me', Icon: Fuel },
    ],
  }
}
