/**
 * The /api/search pipeline, extracted so /api/answer can reuse it.
 *
 * Quota-minimal architecture — three tiers:
 *   1. SerpApi (rich: ratings/reviews/photos) — primary when a key is
 *      present and quota is healthy. ONE call per search, cached 60 min,
 *      keyed by canonicalKey so "davakhana" and "pharmacy" share it.
 *   2. OSM Overpass (free, factual, no key, no quota) — fallback when
 *      there is no SERPAPI_KEY, quota is exhausted/near-limit, SerpApi
 *      errors, or SerpApi returns zero results (then merged + deduped).
 *      Cached 24h in a separate `osm:` namespace.
 *   3. AI (Groq free tier) — everything language-related; never a source
 *      of place facts (see /api/answer's quota-exhausted path).
 *
 * Mock mode (USE_MOCK=true, default) is unchanged: mock file only, no
 * SerpApi calls, no quota counting.
 *
 * Throws SerpApiError on upstream failure (callers map QUOTA_EXCEEDED ->
 * 503, everything else -> 502). The API key never leaves the server.
 */

import { readFile } from "fs/promises";
import path from "path";
import { type Place } from "./schemas";
import { cacheGet, cacheSet, searchCacheKey } from "./cache";
import { canonicalKey } from "./canonical";
import {
  dedupePlaces,
  normalizePlace,
  type SerpApiLocalResult,
} from "./normalize";
import {
  normalizeOsmElement,
  searchOsmElements,
  type OsmOrigin,
} from "./osm";
import { meanRatingOf, scorePlace } from "./score";
import { searchPlaces as serpapiSearchPlaces, SerpApiError } from "./serpapi";
import { isQuotaExceeded, isQuotaNearLimit } from "./usage";
import { db } from "./db";

export const SEARCH_CACHE_TTL_SEC = 60 * 60; // 60 min (was 10)
export const OSM_CACHE_TTL_SEC = 24 * 60 * 60; // 24h
export const MAX_RESULTS = 20;

/** Words that carry no matching signal in mock mode. */
const STOPWORDS = new Set([
  "open", "now", "near", "me", "best", "cheap", "cheapest", "the",
  "a", "an", "to", "in", "at", "for", "and", "of", "late", "is", "are",
]);

export type SearchPipelineInput = {
  query: string;
  lat: number;
  lng: number;
  radiusKm: number;
};

export type SearchFallback = "osm";

export type SearchPipelineResult = {
  places: Place[];
  cached: boolean;
  mock: boolean;
  /** Canonical English key the search (and cache key) was built from. */
  canonicalKey: string;
  /** Set when results came from the OSM fallback tier. */
  fallback?: SearchFallback;
};

function useMock(): boolean {
  return process.env.USE_MOCK !== "false"; // default true
}

async function loadMockResults(): Promise<SerpApiLocalResult[]> {
  const file = path.join(process.cwd(), "mock", "search.json");
  const json = JSON.parse(await readFile(file, "utf8")) as {
    local_results?: SerpApiLocalResult[];
  };
  return json.local_results ?? [];
}

/**
 * Loose keyword filter for mock mode: split the query into words, drop
 * stopwords, match against title + type + category. Empty query -> all.
 * No matching words -> empty (lets the frontend show its empty state).
 */
function filterMock(
  items: SerpApiLocalResult[],
  normalizedQuery: string
): SerpApiLocalResult[] {
  if (!normalizedQuery) return items;
  const words = normalizedQuery
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
  if (words.length === 0) return items;

  const haystackOf = (item: SerpApiLocalResult) =>
    [item.title, item.type, ...(item.types ?? [])]
      .filter((s): s is string => typeof s === "string")
      .join(" ")
      .toLowerCase();

  return items.filter((item) => {
    const hay = haystackOf(item);
    return words.some((w) => hay.includes(w));
  });
}

/** Best-effort analytics row; never fails the request. */
function logSearch(input: {
  query: string;
  lat: number;
  lng: number;
  radiusKm: number;
  results: number;
  cached: boolean;
}): void {
  void (async () => {
    try {
      const prisma = await db();
      if (!prisma) return;
      await prisma.search.create({
        data: {
          query: input.query,
          lat: input.lat,
          lng: input.lng,
          radiusKm: input.radiusKm,
          results: input.results,
          cached: input.cached,
        },
      });
    } catch {
      // silent — analytics must not break search
    }
  })();
}

/** Normalize raw SerpApi items (drops permanently-closed). */
function normalizeSerpApiItems(
  rawItems: SerpApiLocalResult[],
  origin: OsmOrigin,
  now: Date = new Date()
): Place[] {
  const out: Place[] = [];
  for (const item of rawItems) {
    const place = normalizePlace(item, origin, now);
    if (place) out.push(place);
  }
  return out;
}

/**
 * OSM fallback tier with its own 24h cache namespace. Never throws:
 * Overpass failure -> [] (the caller decides error vs empty result).
 */
async function searchOsmCached(
  canonical: string,
  lat: number,
  lng: number,
  radiusKm: number,
  origin: OsmOrigin
): Promise<Place[]> {
  const key = `osm:${canonical}:${lat.toFixed(3)}:${lng.toFixed(3)}:${radiusKm}`;
  const hit = await cacheGet<Place[]>(key);
  if (hit) return hit;

  let places: Place[] = [];
  try {
    const elements = await searchOsmElements(canonical, lat, lng, radiusKm);
    for (const el of elements) {
      const p = normalizeOsmElement(el, origin);
      if (p) places.push(p);
    }
  } catch {
    places = []; // best-effort tier: failure is not fatal
  }
  await cacheSet(key, places, OSM_CACHE_TTL_SEC);
  return places;
}

/**
 * Live-mode fetch with tier routing. Returns normalized places plus an
 * optional fallback flag. Throws SerpApiError when nothing can serve the
 * request (quota exhausted with no OSM data -> 503; total upstream
 * failure -> 502).
 */
async function fetchLive(
  canonical: string,
  lat: number,
  lng: number,
  radiusKm: number,
  origin: OsmOrigin
): Promise<{ places: Place[]; fallback?: SearchFallback }> {
  const apiKey = process.env.SERPAPI_KEY;
  const quotaExceeded = await isQuotaExceeded();
  const quotaNear = await isQuotaNearLimit(0.9);
  const serpApiUsable = Boolean(apiKey) && !quotaExceeded && !quotaNear;

  let serpPlaces: Place[] = [];
  let serpError: unknown = null;

  if (serpApiUsable) {
    try {
      const raw = await serpapiSearchPlaces({
        q: canonical,
        lat,
        lng,
        radiusKm,
        apiKey: apiKey as string,
      });
      serpPlaces = normalizeSerpApiItems(raw as SerpApiLocalResult[], origin);
    } catch (err) {
      serpError = err;
    }
  }

  if (serpPlaces.length > 0) {
    return { places: serpPlaces };
  }

  // Fallback tier: OSM. Reached when there is no key, quota is
  // exhausted/near-limit, SerpApi errored, or SerpApi returned zero
  // results (then merged with the empty SerpApi set and deduped).
  const osmPlaces = await searchOsmCached(canonical, lat, lng, radiusKm, origin);
  const merged = dedupePlaces([...serpPlaces, ...osmPlaces]);
  if (merged.length > 0) {
    return { places: merged, fallback: "osm" };
  }

  if (serpError instanceof SerpApiError) throw serpError; // preserves QUOTA_EXCEEDED -> 503
  if (quotaExceeded) {
    throw new SerpApiError(
      "QUOTA_EXCEEDED",
      "Monthly SerpApi call limit reached"
    );
  }
  if (serpError) {
    throw new SerpApiError(
      "UPSTREAM_ERROR",
      serpError instanceof Error ? serpError.message : "Search failed"
    );
  }
  // No key + OSM empty: honest empty result, not an error.
  return { places: [], fallback: "osm" };
}

/**
 * Run the full search pipeline: cache -> fetch -> normalize -> dedupe ->
 * score -> sort -> cap. Throws SerpApiError on upstream failure.
 */
export async function searchPlaces(
  input: SearchPipelineInput
): Promise<SearchPipelineResult> {
  const { query, lat, lng, radiusKm } = input;

  // Canonical key: "davakhana" and "pharmacy" share one cached SerpApi call.
  const canonical = canonicalKey(query);
  const key = searchCacheKey(canonical, lat, lng, radiusKm);

  const hit = await cacheGet<{
    places: Place[];
    mock: boolean;
    canonicalKey: string;
    fallback?: SearchFallback;
  }>(key);
  if (hit) {
    return {
      places: hit.places,
      cached: true,
      mock: hit.mock,
      canonicalKey: hit.canonicalKey ?? canonical,
      fallback: hit.fallback,
    };
  }

  const origin = { lat, lng };
  let places: Place[];
  let mock = false;
  let fallback: SearchFallback | undefined;

  if (useMock()) {
    mock = true;
    const rawItems = filterMock(await loadMockResults(), canonical);
    places = dedupePlaces(normalizeSerpApiItems(rawItems, origin));
  } else {
    const live = await fetchLive(canonical, lat, lng, radiusKm, origin);
    places = live.places;
    fallback = live.fallback;
  }

  const meanRating = meanRatingOf(places);
  const scored = places
    .map((p) => ({ ...p, score: scorePlace(p, radiusKm, meanRating) }))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, MAX_RESULTS);

  await cacheSet(
    key,
    { places: scored, mock, canonicalKey: canonical, fallback },
    SEARCH_CACHE_TTL_SEC
  );
  logSearch({ query: canonical, lat, lng, radiusKm, results: scored.length, cached: false });

  return { places: scored, cached: false, mock, canonicalKey: canonical, fallback };
}
