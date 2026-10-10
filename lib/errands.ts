/**
 * Errand planning + meet-in-the-middle helpers. Pure functions — no imports,
 * no I/O — so they run on server or client and are trivially testable.
 */

/** Maximum categories per errand plan (each uncached category = 1 SerpApi call). */
export const ERRAND_MAX_CATEGORIES = 4;

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Stop extends LatLng {
  id: string;
}

const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Haversine great-circle distance in km (inlined here — this module imports nothing). */
function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
  return EARTH_RADIUS_KM * c;
}

/**
 * Geographic midpoint — plain average of lat/lng. Fine at city scale.
 */
export function midpoint(a: LatLng, b: LatLng): LatLng {
  return { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
}

/**
 * Greedy nearest-neighbor ordering of stops starting from `start`.
 * Returns a new array; input order is untouched.
 */
export function orderStopsNearestNeighbor(stops: Stop[], start: LatLng): Stop[] {
  const remaining = [...stops];
  const ordered: Stop[] = [];
  let from: LatLng = start;
  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestDist = haversineKm(from, remaining[0]);
    for (let i = 1; i < remaining.length; i++) {
      const d = haversineKm(from, remaining[i]);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    const next = remaining.splice(bestIdx, 1)[0];
    ordered.push(next);
    from = next;
  }
  return ordered;
}

/**
 * Parse free-text errand input ("pharmacy, ATM; groceries\ncoffee") into
 * categories: split on commas/semicolons/newlines, trim, drop empties,
 * dedupe case-insensitively (first spelling wins), cap at 4.
 */
export function parseErrandInput(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of text.split(/[,\n;]+/)) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
    if (out.length >= ERRAND_MAX_CATEGORIES) break;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Time-aware errand ordering                                           */
/* ------------------------------------------------------------------ */

/** Walk speed for arrival estimates (4.5 km/h). Exported for tests. */
export const ERRAND_WALK_KMPH = 4.5;

export interface TimedStop extends Stop {
  /** Display name (for warnings). */
  name: string;
  /** Minutes from `now` until closing, when known. */
  minutesToClose?: number;
}

export interface TimedPlan {
  /** Stops in visit order. */
  ordered: TimedStop[];
  /** Per-stop arrival offset in minutes from `now`, parallel to `ordered`. */
  arrivalMins: number[];
  /** Human-readable warnings, e.g. "Pharmacy closes at 9:00 PM — go there first." */
  warnings: string[];
}

/** Format a Date as "9:00 PM". */
function fmtClock(d: Date): string {
  let h = d.getHours();
  const m = d.getMinutes();
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${String(m).padStart(2, "0")} ${ap}`;
}

function walkMins(from: LatLng, to: LatLng): number {
  return (haversineKm(from, to) / ERRAND_WALK_KMPH) * 60;
}

/**
 * Time-aware greedy ordering: at each step, pick the reachable stop with
 * the least slack before closing (most urgent first); stops with unknown
 * hours fall back to nearest-neighbor after time-sensitive ones. Stops
 * that can't be reached before closing are pushed last and flagged.
 *
 * `now` is injectable for tests (defaults to the current time).
 */
export function orderStopsTimeAware(
  stops: TimedStop[],
  start: LatLng,
  now: Date = new Date()
): TimedPlan {
  const remaining = [...stops];
  const ordered: TimedStop[] = [];
  const arrivalMins: number[] = [];
  const warnings: string[] = [];
  let from: LatLng = start;
  let elapsed = 0;

  const FLEXIBLE_PENALTY = 1e6;
  const UNREACHABLE_PENALTY = 1e9;

  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestScore = Infinity;
    let bestTravel = 0;
    for (let i = 0; i < remaining.length; i++) {
      const s = remaining[i];
      const travel = walkMins(from, s);
      const arrival = elapsed + travel;
      let score: number;
      if (s.minutesToClose != null && Number.isFinite(s.minutesToClose)) {
        const slack = s.minutesToClose - arrival;
        score = slack < 0 ? UNREACHABLE_PENALTY + -slack : slack * 2 + travel;
      } else {
        score = FLEXIBLE_PENALTY + travel;
      }
      if (score < bestScore) {
        bestScore = score;
        bestIdx = i;
        bestTravel = travel;
      }
    }
    const next = remaining.splice(bestIdx, 1)[0];
    const arrival = elapsed + bestTravel;
    ordered.push(next);
    arrivalMins.push(arrival);

    if (next.minutesToClose != null && Number.isFinite(next.minutesToClose)) {
      const closeAt = new Date(now.getTime() + next.minutesToClose * 60000);
      const arriveAt = new Date(now.getTime() + arrival * 60000);
      if (arrival > next.minutesToClose) {
        warnings.push(
          `${next.name} closes at ${fmtClock(closeAt)} — you'll arrive around ${fmtClock(arriveAt)}, likely closed.`
        );
      } else if (next.minutesToClose - arrival < 45) {
        warnings.push(
          `${next.name} closes at ${fmtClock(closeAt)} — placed ${ordered.length === 1 ? "first" : `stop #${ordered.length}`} so you arrive by ${fmtClock(arriveAt)}.`
        );
      }
    }

    elapsed = arrival;
    from = next;
  }

  return { ordered, arrivalMins, warnings };
}
