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
