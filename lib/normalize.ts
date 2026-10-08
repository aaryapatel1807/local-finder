/**
 * Convert one raw SerpApi google_maps `local_results` item into our Place
 * shape (spec section 7.4).
 *
 * Defensive by design: SerpApi field names vary slightly between result
 * types, so every field is read with fallbacks. Verified against the
 * serpapi.com/google-maps-api docs and real sample payloads:
 *   title, place_id, data_id, rating, reviews, price, type, address,
 *   open_state, hours (string), operating_hours ({day: "9AM–5PM"}),
 *   phone, website, gps_coordinates {latitude, longitude}, thumbnail.
 */

import { haversineKm } from "./distance";
import { resolveOpenNow } from "./openState";
import type { Place } from "./schemas";

/** Raw item as SerpApi returns it (subset we care about). */
export type SerpApiLocalResult = {
  title?: string;
  place_id?: string;
  data_id?: string;
  rating?: number;
  reviews?: number;
  price?: string;
  type?: string;
  types?: string[];
  address?: string;
  open_state?: string;
  hours?: string | string[];
  operating_hours?: Record<string, string>;
  phone?: string;
  website?: string;
  gps_coordinates?: { latitude?: number; longitude?: number };
  thumbnail?: string;
  [key: string]: unknown;
};

const DAY_ORDER = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function asNumber(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/,/g, ""));
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function asString(v: unknown): string | undefined {
  if (typeof v === "string" && v.trim()) return v.trim();
  return undefined;
}

/**
 * Parse weekly hours into { Monday: "...", ... }.
 * Handles both forms SerpApi returns:
 *  - operating_hours object:  { monday: "9AM–5PM", tuesday: "Closed", ... }
 *  - hours string array:      ["Monday: 9:00 AM – 11:00 PM", ...]
 * Returns undefined when nothing parseable is present.
 */
export function parseWeeklyHours(
  raw: SerpApiLocalResult
): Record<string, string> | undefined {
  const out: Record<string, string> = {};

  const op = raw.operating_hours;
  if (op && typeof op === "object" && !Array.isArray(op)) {
    for (const [day, hours] of Object.entries(op)) {
      const d = day.toLowerCase();
      if (DAY_ORDER.includes(d) && typeof hours === "string" && hours.trim()) {
        out[capitalize(d)] = hours.trim();
      }
    }
    if (Object.keys(out).length > 0) return out;
  }

  const hours = raw.hours;
  if (Array.isArray(hours)) {
    for (const line of hours) {
      if (typeof line !== "string") continue;
      // "Monday: 9:00 AM – 11:00 PM"
      const m = line.match(/^\s*([A-Za-z]+)\s*:\s*(.+?)\s*$/);
      if (m && DAY_ORDER.includes(m[1].toLowerCase())) {
        out[capitalize(m[1].toLowerCase())] = m[2];
      }
    }
    if (Object.keys(out).length > 0) return out;
  }

  return undefined;
}

/** Today's weekday key, capitalized ("Monday"). */
function todayKey(now: Date = new Date()): string {
  return now.toLocaleDateString("en-US", { weekday: "long" });
}

export type GeoOrigin = { lat: number; lng: number };

/**
 * Normalize one SerpApi result. Returns null when the item must be excluded
 * (currently: "Permanently closed" places).
 */
export function normalizePlace(
  raw: SerpApiLocalResult,
  origin: GeoOrigin,
  now: Date = new Date()
): Place | null {
  const openStateRaw = asString(raw.open_state);

  if (openStateRaw && openStateRaw.toLowerCase().includes("permanently closed")) {
    return null; // excluded from results (spec 7.5)
  }

  const weeklyHours = parseWeeklyHours(raw);
  const status = resolveOpenNow(
    { open_state: openStateRaw, weeklyHours },
    now
  );
  const hoursToday = weeklyHours ? weeklyHours[todayKey(now)] : undefined;

  const lat = raw.gps_coordinates?.latitude;
  const lng = raw.gps_coordinates?.longitude;
  const hasCoords = typeof lat === "number" && typeof lng === "number";

  const category = asString(raw.type) ?? (Array.isArray(raw.types) ? asString(raw.types[0]) : undefined);

  return {
    id: asString(raw.place_id) ?? asString(raw.data_id) ?? `mock:${(asString(raw.title) ?? "place").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    dataId: asString(raw.data_id),
    name: asString(raw.title) ?? "Unknown place",
    category,
    rating: asNumber(raw.rating),
    reviews: asNumber(raw.reviews),
    price: asString(raw.price),
    address: asString(raw.address),
    phone: asString(raw.phone),
    website: asString(raw.website),
    openLabel: openStateRaw,
    isOpen: status.isOpen,
    closesSoon: status.closesSoon,
    hoursToday,
    weeklyHours,
    lat: hasCoords ? (lat as number) : 0,
    lng: hasCoords ? (lng as number) : 0,
    distanceKm: hasCoords
      ? Math.round(haversineKm(origin.lat, origin.lng, lat as number, lng as number) * 100) / 100
      : undefined,
    thumbnail: asString(raw.thumbnail),
  };
}

/* ------------------------------------------------------------------ */
/* Duplicate detection (phase 2).                                      */
/* ------------------------------------------------------------------ */

/** Name similarity (token-set Jaccard) at or above this => same listing. */
export const DUPE_NAME_SIMILARITY = 0.8;
/** Haversine distance under this (km) together with name similarity => dupe. */
export const DUPE_MAX_DISTANCE_KM = 0.15;

/**
 * Tokenize a place name: lowercase, strip non-alphanumerics, drop empties.
 * Exported for tests.
 */
export function nameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Token-set Jaccard similarity between two names, 0..1.
 * 1 when both names tokenize to nothing (degenerate, never a dupe alone).
 * Exported for tests.
 */
export function nameSimilarity(a: string, b: string): number {
  const setA = new Set(nameTokens(a));
  const setB = new Set(nameTokens(b));
  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  setA.forEach((t) => {
    if (setB.has(t)) intersection++;
  });
  return intersection / (setA.size + setB.size - intersection);
}

/**
 * Two places are the same listing when their names are near-identical
 * (similarity >= 0.8) AND they sit within 0.15 km of each other
 * (SerpApi often returns the same shop under a slightly different title).
 */
export function isDupe(a: Place, b: Place): boolean {
  if (nameSimilarity(a.name, b.name) < DUPE_NAME_SIMILARITY) return false;
  return haversineKm(a.lat, a.lng, b.lat, b.lng) < DUPE_MAX_DISTANCE_KM;
}

/**
 * Drop duplicates from a normalized places list. Keeps the listing with
 * more reviews; ties break on higher rating. Order of first appearance
 * is otherwise preserved.
 */
export function dedupePlaces(places: Place[]): Place[] {
  const kept: Place[] = [];
  for (const p of places) {
    const idx = kept.findIndex((k) => isDupe(k, p));
    if (idx === -1) {
      kept.push(p);
      continue;
    }
    const cur = kept[idx];
    const pReviews = p.reviews ?? 0;
    const curReviews = cur.reviews ?? 0;
    if (
      pReviews > curReviews ||
      (pReviews === curReviews && (p.rating ?? 0) > (cur.rating ?? 0))
    ) {
      kept[idx] = p;
    }
  }
  return kept;
}
