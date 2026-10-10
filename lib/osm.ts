/**
 * OpenStreetMap fallback tier (quota-minimal architecture).
 *
 * Free, factual, no key, no quota: the Overpass API supplies real POIs when
 * SerpApi is unavailable (no key, quota exhausted/near-limit, upstream
 * error, or zero results). One polite query per search (~15 s timeout).
 *
 * OSM has no ratings/reviews/photos — scoring degrades gracefully
 * (distance + open-status weighted fallback; see lib/score.ts). Results
 * are normalized to the Place shape with `source: "osm"` so the UI can
 * badge them as community data.
 */

import { haversineKm } from "./distance";
import type { Place } from "./schemas";

export class OsmError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OsmError";
  }
}

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const OVERPASS_TIMEOUT_MS = 15_000;
const MAX_ELEMENTS = 40;

/** canonicalKey -> Overpass tag selectors. */
const CATEGORY_TAGS: Record<string, string[]> = {
  pharmacy: [
    '["amenity"="pharmacy"]',
    '["shop"="chemist"]',
    '["shop"="pharmacy"]',
    // Name fallback: many Indian medical stores aren't tagged as pharmacies
    // but have pharmacy/medical/chemist/davakhana in the name.
    '["name"~"(pharmacy|medical|chemist|davakhana|medico)",i]',
  ],
  atm: ['["amenity"="atm"]', '["amenity"="bank"]["atm"="yes"]'],
  petrol: ['["amenity"="fuel"]'],
  clinic: ['["amenity"~"^(clinic|doctors)$"]'],
  hospital: ['["amenity"="hospital"]'],
  chai: ['["amenity"="cafe"]'],
  cafe: ['["amenity"="cafe"]'],
  restaurant: ['["amenity"="restaurant"]'],
  groceries: ['["shop"~"^(supermarket|convenience|grocery)$"]'],
  stationery: ['["shop"="stationery"]'],
  mechanic: ['["shop"="car_repair"]'],
  bank: ['["amenity"="bank"]'],
  salon: ['["shop"~"^(hairdresser|beauty)$"]'],
};

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Build the Overpass QL query. Category queries use tag selectors;
 * anything else falls back to a bounded case-insensitive name match.
 * Exported for tests.
 */
export function buildOverpassQuery(
  canonical: string,
  lat: number,
  lng: number,
  radiusKm: number
): string {
  const radiusM = Math.round(radiusKm * 1000);
  const around = `(around:${radiusM},${lat},${lng})`;
  const selectors = CATEGORY_TAGS[canonical];
  let clauses: string;
  if (selectors) {
    clauses = selectors
      .map((s) => `node${s}${around};way${s}${around};`)
      .join("");
  } else {
    const escaped = escapeRegExp(canonical).slice(0, 40);
    clauses =
      `node["name"~"${escaped}",i]${around};` +
      `way["name"~"${escaped}",i]${around};`;
  }
  return `[out:json][timeout:15];(${clauses});out center ${MAX_ELEMENTS};`;
}

/** Raw Overpass element (subset we read). */
export type OsmElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

/**
 * Fetch POIs from Overpass. Throws OsmError on ANY failure — callers
 * decide whether that is fatal (it usually is not: the fallback tier is
 * best-effort).
 */
export async function searchOsmElements(
  canonical: string,
  lat: number,
  lng: number,
  radiusKm: number
): Promise<OsmElement[]> {
  const query = buildOverpassQuery(canonical, lat, lng, radiusKm);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), OVERPASS_TIMEOUT_MS);
  try {
    const res = await fetch(OVERPASS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "LocalFinder/1.0 (quota-minimal OSM fallback tier)",
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: ctrl.signal,
    });
    if (!res.ok) throw new OsmError(`Overpass HTTP ${res.status}`);
    const json = (await res.json()) as { elements?: unknown };
    const els = Array.isArray(json.elements) ? json.elements : [];
    return (els as OsmElement[]).slice(0, MAX_ELEMENTS);
  } catch (err) {
    if (err instanceof OsmError) throw err;
    throw new OsmError(
      err instanceof Error ? err.message : "Overpass request failed"
    );
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------------------------------ */
/* OSM opening_hours parsing (best effort).                            */
/* ------------------------------------------------------------------ */

const DAY_ABBR: Record<string, number> = {
  mo: 1,
  tu: 2,
  we: 3,
  th: 4,
  fr: 5,
  sa: 6,
  su: 0,
};

function parseTimeToMin(t: string): number | null {
  const m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 24 || min > 59 || (h === 24 && min !== 0)) return null;
  return h * 60 + min;
}

/** "Mo-Fr" / "Sa" / "Mo,We,Fr" -> set of JS getDay() values. Null = unparseable. */
function daysFromSpec(spec: string): Set<number> | null {
  const days = new Set<number>();
  for (const part of spec.split(",")) {
    const p = part.trim().toLowerCase();
    if (!p) continue;
    const range = p.match(/^([a-z]{2})\s*-\s*([a-z]{2})$/);
    if (range) {
      const s = DAY_ABBR[range[1]];
      const e = DAY_ABBR[range[2]];
      if (s === undefined || e === undefined) return null;
      let d = s;
      for (;;) {
        days.add(d);
        if (d === e) break;
        d = (d + 1) % 7;
      }
    } else {
      const d = DAY_ABBR[p];
      if (d === undefined) return null;
      days.add(d);
    }
  }
  return days.size > 0 ? days : null;
}

export type OsmOpenState = {
  isOpen: boolean | null;
  /** Friendly label, e.g. "Open 24 hours". */
  label?: string;
  /** Today's closing info, e.g. "Closes 18:00". */
  hoursToday?: string;
};

/**
 * Best-effort parse of an OSM opening_hours string against `now`.
 * Handles "24/7", day ranges (Mo-Fr), comma day lists, multiple daily
 * spans, and overnight spans (18:00-02:00, checked against yesterday's
 * rules too). Anything unparseable -> { isOpen: null } (grey badge —
 * the UI already handles unknown hours).
 */
export function parseOsmOpeningHours(
  hours: string,
  now: Date = new Date()
): OsmOpenState {
  const raw = hours.trim();
  if (!raw) return { isOpen: null };
  if (/^24\/7$/i.test(raw)) return { isOpen: true, label: "Open 24 hours" };

  const day = now.getDay();
  const yesterday = (day + 6) % 7;
  const mins = now.getHours() * 60 + now.getMinutes();

  let parsedAny = false;
  let closesAt: number | null = null;

  const spanOpen = (
    start: number,
    end: number,
    appliesToday: boolean,
    appliesYesterday: boolean
  ): boolean => {
    if (end > start) {
      return appliesToday && mins >= start && mins < end;
    }
    // Overnight span: today's entry covers this evening, yesterday's
    // entry covers the small hours.
    return (
      (appliesToday && mins >= start) || (appliesYesterday && mins < end)
    );
  };

  for (const rule of raw.split(";")) {
    const r = rule.trim();
    if (!r || /^(off|closed)$/i.test(r)) continue;
    // Optional day spec + one or more HH:MM-HH:MM spans.
    const m = r.match(
      /^(?:([A-Za-z]{2}(?:\s*-\s*[A-Za-z]{2})?(?:\s*,\s*[A-Za-z]{2}(?:\s*-\s*[A-Za-z]{2})?)*)\s+)?(\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}(?:\s*,\s*\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2})*)$/
    );
    if (!m) continue;
    const days = m[1] ? daysFromSpec(m[1]) : new Set([0, 1, 2, 3, 4, 5, 6]);
    if (!days) continue;
    parsedAny = true;
    const appliesToday = days.has(day);
    const appliesYesterday = days.has(yesterday);
    if (!appliesToday && !appliesYesterday) continue;
    for (const span of m[2].split(",")) {
      const [a, b] = span.split("-").map((s) => s.trim());
      const start = parseTimeToMin(a);
      const end = parseTimeToMin(b);
      if (start === null || end === null) continue;
      if (spanOpen(start, end, appliesToday, appliesYesterday)) {
        closesAt = end;
        break;
      }
    }
    if (closesAt !== null) break;
  }

  if (closesAt !== null) {
    const h = Math.floor(closesAt / 60) % 24;
    const mm = String(closesAt % 60).padStart(2, "0");
    return {
      isOpen: true,
      label: "Open now",
      hoursToday: `Closes ${h}:${mm}`,
    };
  }
  if (parsedAny) return { isOpen: false, label: "Closed" };
  return { isOpen: null };
}

/* ------------------------------------------------------------------ */
/* Normalization to the Place shape.                                    */
/* ------------------------------------------------------------------ */

export type OsmOrigin = { lat: number; lng: number };

function buildAddress(tags: Record<string, string>): string | undefined {
  const parts = [
    tags["addr:housenumber"],
    tags["addr:street"],
    tags["addr:suburb"] ?? tags["addr:neighbourhood"],
    tags["addr:city"] ?? tags["addr:town"] ?? tags["addr:village"],
  ].filter((s): s is string => typeof s === "string" && s.trim().length > 0);
  return parts.length > 0 ? parts.join(", ") : undefined;
}

/**
 * Normalize one Overpass element to a Place. Returns null when the
 * element is unusable (unnamed, or no coordinates).
 */
export function normalizeOsmElement(
  el: OsmElement,
  origin: OsmOrigin,
  now: Date = new Date()
): Place | null {
  const tags = el.tags ?? {};
  const name = (tags.name ?? "").trim();
  if (!name) return null; // unnamed POIs are not useful results

  const lat = el.type === "node" ? el.lat : el.center?.lat;
  const lng = el.type === "node" ? el.lon : el.center?.lon;
  if (typeof lat !== "number" || typeof lng !== "number") return null;

  const openState = tags.opening_hours
    ? parseOsmOpeningHours(tags.opening_hours, now)
    : { isOpen: null as boolean | null };

  return {
    id: `osm:${el.type}/${el.id}`,
    name,
    category: tags.amenity ?? tags.shop,
    address: buildAddress(tags),
    phone: tags.phone ?? tags["contact:phone"],
    website: tags.website ?? tags["contact:website"],
    openLabel: openState.label,
    isOpen: openState.isOpen,
    closesSoon: false,
    hoursToday: openState.hoursToday,
    lat,
    lng,
    distanceKm:
      Math.round(haversineKm(origin.lat, origin.lng, lat, lng) * 100) / 100,
    source: "osm",
  };
}
