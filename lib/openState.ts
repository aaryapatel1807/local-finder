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

/* ------------------------------------------------------------------ */
/* Real open-now from weeklyHours (phase 2).                           */
/* ------------------------------------------------------------------ */

/**
 * Parse "10:00 AM", "9AM", "21:30" style tokens into minutes since
 * midnight. Returns null when unparseable.
 */
function parseTimeOfDay(token: string): number | null {
  const t = token.trim();
  const m12 = t.match(/^(\d{1,2})(?::(\d{2}))?\s*([ap])\.?\s*m\.?$/i);
  if (m12) {
    let h = parseInt(m12[1], 10);
    const min = m12[2] ? parseInt(m12[2], 10) : 0;
    const pm = m12[3].toLowerCase() === "p";
    if (h < 1 || h > 12 || min > 59) return null;
    if (pm && h !== 12) h += 12;
    if (!pm && h === 12) h = 0;
    return h * 60 + min;
  }
  const m24 = t.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (m24) return parseInt(m24[1], 10) * 60 + parseInt(m24[2], 10);
  return null;
}

type HoursInterval = { open: number; close: number };

const DAY_ORDER_LOWER = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

/** "mon" -> "monday", etc. */
function expandDayAbbr(key: string): string {
  const k = key.trim().toLowerCase();
  const hit = DAY_ORDER_LOWER.find((d) => d.startsWith(k) && k.length >= 3);
  return hit ?? k;
}

/**
 * Find today's hours value, tolerating key variants: full names ("Monday",
 * "monday") and 3-letter forms ("Mon", "mon"). Returns undefined when the
 * day is absent.
 */
export function hoursForDate(
  weeklyHours: Record<string, string>,
  date: Date
): string | undefined {
  const full = date
    .toLocaleDateString("en-US", { weekday: "long" })
    .toLowerCase();
  const short = date
    .toLocaleDateString("en-US", { weekday: "short" })
    .toLowerCase();
  for (const [key, value] of Object.entries(weeklyHours)) {
    if (typeof value !== "string") continue;
    const norm = expandDayAbbr(key);
    if (norm === full || norm === short) return value;
  }
  return undefined;
}

/**
 * Parse a weekly-hours value into open/close intervals.
 * Handles "10:00 AM – 11:00 PM" (en/em dash or hyphen), multi-interval days
 * like "9:00 AM – 1:00 PM, 5:00 PM – 9:00 PM", "Open 24 hours" and "Closed".
 * Returns null when unparseable, [] when closed all day.
 */
export function parseHoursValue(value: string): HoursInterval[] | null {
  const v = value.trim();
  const lower = v.toLowerCase();
  if (/open\s*24\s*hours/.test(lower)) return [{ open: 0, close: 24 * 60 }];
  if (/\bclosed\b/.test(lower)) return [];

  const intervals: HoursInterval[] = [];
  for (const segment of v.split(/[,;]/)) {
    const parts = segment.split(/[–—-]/);
    if (parts.length !== 2) return null;
    const open = parseTimeOfDay(parts[0]);
    const close = parseTimeOfDay(parts[1]);
    if (open === null || close === null) return null;
    intervals.push({ open, close });
  }
  if (intervals.length === 0) return null;
  return intervals;
}

/**
 * Open status from parsed intervals for a given minute-of-day.
 * close < open means an overnight window (spans into the next day).
 */
function statusFromIntervals(
  intervals: HoursInterval[],
  nowMin: number,
  label: string
): OpenStatus {
  if (intervals.length === 0) {
    return { isOpen: false, closesSoon: false, label };
  }
  for (const iv of intervals) {
    const overnight = iv.close < iv.open;
    const open = overnight
      ? nowMin >= iv.open || nowMin < iv.close
      : nowMin >= iv.open && nowMin < iv.close;
    if (open) {
      const minsLeft = overnight
        ? nowMin >= iv.open
          ? 24 * 60 - nowMin + iv.close
          : iv.close - nowMin
        : iv.close - nowMin;
      return {
        isOpen: true,
        closesSoon: minsLeft <= CLOSES_SOON_MINUTES,
        label,
      };
    }
  }
  return { isOpen: false, closesSoon: false, label };
}

/**
 * Real open-now from a place's weeklyHours, evaluated at `now`.
 *
 * - Matches `now`'s weekday against the hours keys (full names and
 *   3-letter variants, case-insensitive).
 * - "Open 24 hours" => open, never closing soon.
 * - Overnight "10:00 AM – 2:00 AM" (close < open) spans into the next day,
 *   including yesterday's window spilling past midnight.
 * - closesSoon when the place closes within 30 minutes.
 * - Falls back to the existing open_state text parsing when weeklyHours
 *   is missing, has no entry for the day, or is unparseable.
 */
export function resolveOpenNow(
  place: { open_state?: string | null; weeklyHours?: Record<string, string> },
  now: Date = new Date()
): OpenStatus {
  const weeklyHours = place.weeklyHours;
  if (weeklyHours && typeof weeklyHours === "object") {
    const nowMin = now.getHours() * 60 + now.getMinutes();

    const todayValue = hoursForDate(weeklyHours, now);
    if (todayValue !== undefined) {
      const intervals = parseHoursValue(todayValue);
      if (intervals !== null) {
        return statusFromIntervals(intervals, nowMin, todayValue);
      }
      // Unparseable value -> fall through to open_state.
    } else {
      // No entry for today: check yesterday's overnight window spilling
      // past midnight (e.g. Thursday "10:00 AM – 2:00 AM" at Friday 1:00 AM).
      // When yesterday ran overnight, the small hours of today belong to
      // that window: open before its close, closed after.
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const yValue = hoursForDate(weeklyHours, yesterday);
      if (yValue !== undefined) {
        const intervals = parseHoursValue(yValue);
        if (intervals !== null) {
          const overnight = intervals.filter((iv) => iv.close < iv.open);
          if (overnight.length > 0) {
            const stillOpen = overnight.filter((iv) => nowMin < iv.close);
            if (stillOpen.length > 0) {
              const minsLeft = Math.min(
                ...stillOpen.map((iv) => iv.close - nowMin)
              );
              return {
                isOpen: true,
                closesSoon: minsLeft <= CLOSES_SOON_MINUTES,
                label: yValue,
              };
            }
            return { isOpen: false, closesSoon: false, label: yValue };
          }
        }
      }
    }
  }

  return parseOpenState(place.open_state, now);
}
