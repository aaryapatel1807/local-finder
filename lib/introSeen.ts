/**
 * localStorage helpers for the first-visit intro modal.
 * Key: 'localfinder_intro_seen'. All access is try/catch wrapped so private
 * browsing / disabled storage never throws.
 */

const INTRO_SEEN_KEY = 'localfinder_intro_seen'

/** Returns true when the intro has been shown (and dismissed) before. */
export function hasSeenIntro(): boolean {
  try {
    return window.localStorage.getItem(INTRO_SEEN_KEY) === '1'
  } catch {
    return false
  }
}

/** Records that the intro has been shown/dismissed. */
export function markIntroSeen(): void {
  try {
    window.localStorage.setItem(INTRO_SEEN_KEY, '1')
  } catch {
    /* storage unavailable — intro will simply show again next visit */
  }
}
