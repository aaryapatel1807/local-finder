/**
 * Parse SerpApi `open_state` strings into a normalized open status.
 *
 * SerpApi hands us free text like "Open ⋅ Closes 11 pm", "Open 24 hours",
 * "Closed ⋅ Opens 9 am", "Temporarily closed", or nothing at all.
 * The UI needs a reliable { isOpen, closesSoon, label } triple, so every
 * decision in this file is defensive: anything we can't parse degrades to
 * "open but not closing soon" / "unknown", never to a wrong hard verdict.
 *
 * Callers exclude "Permanently closed" places entirely (see normalize.ts);
 * this parser just reports them as closed.
 */

export type OpenStatus = {
  /** true = open, false = closed, null = unknown (missing hours). */
  isOpen: boolean | null;
  /** true when the place closes within 30 minutes (amber badge). */
  closesSoon: boolean;
  /** The raw string for display, or "Hours unknown". */
  label: string;
};

const CLOSES_SOON_MINUTES = 30;

/** "Closes 11 pm" / "Closes 11:30 pm" / "⋅ Closes 9:30 pm" / 24h "Closes 21:30". */
const CLOSES_TIME_RE = /closes?\s+(\d{1,2})(?::(\d{2}))?\s*([ap])\.?\s*m\.?/i;
const CLOSES_TIME_24H_RE = /closes?\s+([01]?\d|2[0-3]):([0-5]\d)(?!\s*[ap]\.?m\.?)/i;

/**
 * Convert a "closes at" time-of-day to minutes from now.
 * Handles 12:05 am style midnight crossings: if the closing time today is
 * already past, assume it means tomorrow (i.e. still open tonight).
 * Returns null when unparseable.
 */
function minutesUntilClose(hour24: number, minute: number, now: Date): number | null {
  const close = new Date(now);
  close.setHours(hour24, minute, 0, 0);
  let diffMin = (close.getTime() - now.getTime()) / 60000;
  if (diffMin < 0) diffMin += 24 * 60; // e.g. "Closes 12:05 am" read at 11:50 pm
  return diffMin;
}

/**
 * Extract minutes-until-closing from an open_state string, or null when the
 * string carries no parseable closing time.
 */
export function parseClosingMinutes(openState: string, now: Date = new Date()): number | null {
  const m12 = openState.match(CLOSES_TIME_RE);
  if (m12) {
    let hour = parseInt(m12[1], 10);
    const minute = m12[2] ? parseInt(m12[2], 10) : 0;
    const isPm = m12[3].toLowerCase() === "p";
    if (hour < 1 || hour > 12) return null;
    if (isPm && hour !== 12) hour += 12;
    if (!isPm && hour === 12) hour = 0;
    return minutesUntilClose(hour, minute, now);
  }
  const m24 = openState.match(CLOSES_TIME_24H_RE);
  if (m24) {
    return minutesUntilClose(parseInt(m24[1], 10), parseInt(m24[2], 10), now);
  }
  return null;
}

const CLOSED_WORDS = ["permanently closed", "temporarily closed"];

/**
 * Parse a SerpApi open_state string.
 *
 * @param openState raw string from SerpApi; may be undefined/empty.
 * @param now injected clock for tests (defaults to current time).
 */
export function parseOpenState(openState?: string | null, now: Date = new Date()): OpenStatus {
  const raw = (openState ?? "").trim();

  if (!raw) {
    return { isOpen: null, closesSoon: false, label: "Hours unknown" };
  }

  const lower = raw.toLowerCase();

  // Hard closures always win, even if the string also mentions hours.
  if (CLOSED_WORDS.some((w) => lower.includes(w))) {
    return { isOpen: false, closesSoon: false, label: raw };
  }

  // Strip leading separators like "⋅ Open ..." just in case.
  const normalized = raw.replace(/^[⋅·•\-–—\s]+/, "");

  if (/^open\b/i.test(normalized)) {
    if (/open 24 hours/i.test(normalized)) {
      return { isOpen: true, closesSoon: false, label: raw };
    }
    if (/closes soon/i.test(normalized)) {
      return { isOpen: true, closesSoon: true, label: raw };
    }
    const mins = parseClosingMinutes(normalized, now);
    if (mins !== null && mins <= CLOSES_SOON_MINUTES) {
      return { isOpen: true, closesSoon: true, label: raw };
    }
    return { isOpen: true, closesSoon: false, label: raw };
  }

  if (/^closed\b/i.test(normalized)) {
    return { isOpen: false, closesSoon: false, label: raw };
  }

  // Unrecognized string — safest to say unknown rather than guess.
  return { isOpen: null, closesSoon: false, label: raw };
}
