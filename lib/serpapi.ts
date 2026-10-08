/**
 * Thin fetch wrapper around SerpApi's Google Maps engines.
 *
 * - searchPlaces: engine=google_maps, type=search, reads `local_results`.
 * - fetchReviews: engine=google_maps_reviews, reads `reviews` (first 10).
 *
 * Every call is quota-guarded first and counted afterwards. Thrown errors
 * carry a `code` of QUOTA_EXCEEDED or UPSTREAM_ERROR so routes can map them
 * to the right status per the 7.8 error contract.
 *
 * NEVER call this from the browser. Routes only.
 */

import { getCallsThisMonth, getMonthlyLimit, incrementCalls } from "./usage";

export type SerpApiErrorCode = "QUOTA_EXCEEDED" | "UPSTREAM_ERROR";

export class SerpApiError extends Error {
  code: SerpApiErrorCode;
  detail?: string;
  constructor(code: SerpApiErrorCode, message: string, detail?: string) {
    super(message);
    this.code = code;
    this.detail = detail;
  }
}

/** Zoom level for the `ll` param, per spec 7.3 (radius -> zoom). */
export function zoomForRadius(radiusKm: number): number {
  switch (radiusKm) {
    case 1:
      return 15;
    case 3:
      return 14;
    case 5:
      return 13;
    case 10:
      return 12;
    default:
      return 14;
  }
}

export type SearchPlacesParams = {
  q: string;
  lat: number;
  lng: number;
  radiusKm: number;
  apiKey: string;
};

async function guardQuota(): Promise<void> {
  const [calls, limit] = [await getCallsThisMonth(), getMonthlyLimit()];
  if (calls >= limit) {
    throw new SerpApiError(
      "QUOTA_EXCEEDED",
      `Monthly SerpApi call limit reached (${calls}/${limit})`
    );
  }
}

async function serpGet(url: string): Promise<Record<string, unknown>> {
  let res: Response;
  try {
    res = await fetch(url, { headers: { Accept: "application/json" } });
  } catch (err) {
    throw new SerpApiError(
      "UPSTREAM_ERROR",
      "Could not reach the SerpApi service",
      err instanceof Error ? err.message : String(err)
    );
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new SerpApiError(
      "UPSTREAM_ERROR",
      `SerpApi returned HTTP ${res.status}`,
      body.slice(0, 500)
    );
  }
  return (await res.json()) as Record<string, unknown>;
}

/**
 * Search Google Maps via SerpApi. Returns raw `local_results` items —
 * callers normalize them with lib/normalize.ts.
 */
export async function searchPlaces(
  params: SearchPlacesParams
): Promise<Record<string, unknown>[]> {
  const { q, lat, lng, radiusKm, apiKey } = params;
  await guardQuota();

  const query = new URLSearchParams({
    engine: "google_maps",
    type: "search",
    q,
    ll: `@${lat},${lng},${zoomForRadius(radiusKm)}z`,
    hl: "en",
    api_key: apiKey,
  });

  const json = await serpGet(`https://serpapi.com/search.json?${query.toString()}`);
  await incrementCalls(1);

  const results = json["local_results"];
  return Array.isArray(results) ? (results as Record<string, unknown>[]) : [];
}

export type FetchReviewsParams = { dataId: string; apiKey: string };

/**
 * Fetch reviews for one place. Returns up to 10 raw review objects
 * ({ snippet, rating, date, ... }).
 */
export async function fetchReviews(
  params: FetchReviewsParams
): Promise<Record<string, unknown>[]> {
  const { dataId, apiKey } = params;
  await guardQuota();

  const query = new URLSearchParams({
    engine: "google_maps_reviews",
    data_id: dataId,
    sort_by: "qualityScore",
    hl: "en",
    api_key: apiKey,
  });

  const json = await serpGet(`https://serpapi.com/search.json?${query.toString()}`);
  await incrementCalls(1);

  const reviews = json["reviews"];
  const list = Array.isArray(reviews) ? reviews : [];
  return (list as Record<string, unknown>[]).slice(0, 10);
}
