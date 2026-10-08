/**
 * The /api/search pipeline, extracted so /api/answer can reuse it.
 *
 * Lifecycle (spec 7.2):
 *  1. Normalize the query -> cache lookup (10 min TTL) -> { cached: true }.
 *  2. Miss: mock file (USE_MOCK=true, default) or SerpApi -> normalize ->
 *     drop permanently-closed -> dedupe -> distance + best-match score ->
 *     sort -> cap 20.
 *  3. Store in cache, best-effort DB log, return { cached: false, ... }.
 *
 * Mock-mode searches never touch SerpApi and never increment the quota
 * counter. The API key never leaves the server.
 *
 * Throws SerpApiError on upstream failure (callers map QUOTA_EXCEEDED ->
 * 503, everything else -> 502).
 */

import { readFile } from "fs/promises";
import path from "path";
import { type Place } from "./schemas";
import { cacheGet, cacheSet, searchCacheKey } from "./cache";
import {
  dedupePlaces,
  normalizePlace,
  type SerpApiLocalResult,
} from "./normalize";
import { meanRatingOf, scorePlace } from "./score";
import { searchPlaces as serpapiSearchPlaces, SerpApiError } from "./serpapi";
import { db } from "./db";

export const SEARCH_CACHE_TTL_SEC = 10 * 60;
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

export type SearchPipelineResult = {
  places: Place[];
  cached: boolean;
  mock: boolean;
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

/**
 * Run the full search pipeline: cache -> fetch -> normalize -> dedupe ->
 * score -> sort -> cap. Throws SerpApiError on upstream failure.
 */
export async function searchPlaces(
  input: SearchPipelineInput
): Promise<SearchPipelineResult> {
  const { query, lat, lng, radiusKm } = input;

  const normalizedQuery = query.trim().toLowerCase().replace(/\s+/g, " ");
  const key = searchCacheKey(normalizedQuery, lat, lng, radiusKm);

  const hit = await cacheGet<{ places: Place[]; mock: boolean }>(key);
  if (hit) {
    return { places: hit.places, cached: true, mock: hit.mock };
  }

  let rawItems: SerpApiLocalResult[];
  let mock = false;

  if (useMock()) {
    mock = true;
    rawItems = filterMock(await loadMockResults(), normalizedQuery);
  } else {
    const apiKey = process.env.SERPAPI_KEY;
    if (!apiKey) {
      throw new Error("SERPAPI_KEY is not set");
    }
    try {
      rawItems = (await serpapiSearchPlaces({
        q: query,
        lat,
        lng,
        radiusKm,
        apiKey,
      })) as SerpApiLocalResult[];
    } catch (err) {
      if (err instanceof SerpApiError) throw err;
      throw new SerpApiError(
        "UPSTREAM_ERROR",
        err instanceof Error ? err.message : "Upstream request failed"
      );
    }
  }

  const origin = { lat, lng };
  const normalized: Place[] = [];
  for (const item of rawItems) {
    const place = normalizePlace(item, origin);
    if (place) normalized.push(place); // null = permanently closed, excluded
  }

  const deduped = dedupePlaces(normalized);
  const meanRating = meanRatingOf(deduped);
  const scored = deduped
    .map((p) => ({ ...p, score: scorePlace(p, radiusKm, meanRating) }))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, MAX_RESULTS);

  await cacheSet(key, { places: scored, mock }, SEARCH_CACHE_TTL_SEC);
  logSearch({ query: normalizedQuery, lat, lng, radiusKm, results: scored.length, cached: false });

  return { places: scored, cached: false, mock };
}
