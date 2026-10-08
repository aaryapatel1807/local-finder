/**
 * Forward geocoding via Photon (Komoot) — keyless, ₹0.
 *
 * https://photon.komoot.io — free Nominatim-based geocoder, no API key.
 * Used by GET /api/geocode so the frontend can turn a typed place name
 * ("Vadodara railway station") into lat/lng without a SerpApi call.
 *
 * Results are cached 7 days; network failure degrades to null (the caller
 * answers 404) instead of throwing.
 */

import { cacheGet, cacheSet } from "./cache";

const PHOTON_URL = "https://photon.komoot.io/api/";
const GEOCODE_TTL_SEC = 7 * 24 * 60 * 60; // 7 days

export type GeocodeResult = {
  lat: number;
  lng: number;
  label: string;
};

/** Cache key: normalized query so trivially different casings share entries. */
export function geocodeCacheKey(query: string): string {
  return `geocode:${query.trim().toLowerCase().replace(/\s+/g, " ")}`;
}

type PhotonFeature = {
  geometry?: { coordinates?: unknown };
  properties?: {
    name?: string;
    city?: string;
    state?: string;
    country?: string;
  };
};

type PhotonResponse = {
  features?: PhotonFeature[];
};

/**
 * Geocode a free-text place query.
 *
 * Returns { lat, lng, label } for the top Photon hit, or null when the
 * query is empty, Photon has no features, or the network fails.
 */
export async function geocodePlace(
  query: string
): Promise<GeocodeResult | null> {
  const q = query.trim();
  if (!q) return null;

  const key = geocodeCacheKey(q);
  const hit = await cacheGet<GeocodeResult>(key);
  if (hit) return hit;

  try {
    const res = await fetch(`${PHOTON_URL}?q=${encodeURIComponent(q)}&limit=1`);
    if (!res.ok) return null;

    const json = (await res.json()) as PhotonResponse;
    const feature = json.features?.[0];
    const coords = feature?.geometry?.coordinates;
    const props = feature?.properties;

    // Photon returns [lng, lat].
    if (!Array.isArray(coords) || coords.length < 2) return null;
    const [lng, lat] = coords as number[];
    if (
      typeof lat !== "number" ||
      typeof lng !== "number" ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng)
    ) {
      return null;
    }

    const name = props?.name?.trim();
    if (!name) return null;

    const label = [name, props?.city ?? props?.state, props?.country]
      .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
      .join(", ");

    const result: GeocodeResult = { lat, lng, label };
    await cacheSet(key, result, GEOCODE_TTL_SEC);
    return result;
  } catch {
    // Network failure degrades to null — never throws.
    return null;
  }
}
