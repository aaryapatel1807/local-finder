/**
 * POST /api/search — nearby place search.
 *
 * Lifecycle (spec 7.2):
 *  1. Zod-validate the body -> 400 INVALID_INPUT.
 *  2. Per-IP rate limit (20/hour) -> 429 RATE_LIMITED.
 *  3. Cache lookup (10 min TTL) -> { cached: true, ... }.
 *  4. Miss: mock file (USE_MOCK=true, default) or SerpApi -> normalize ->
 *     drop permanently-closed -> distance + best-match score -> sort -> cap 20.
 *  5. Store in cache, best-effort DB log, return { cached: false, ... }.
 *
 * Mock-mode searches never touch SerpApi and never increment the quota
 * counter. The API key never leaves the server.
 */

import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { SearchRequestSchema, type Place } from "@/lib/schemas";
import {
  checkRateLimit,
  getClientIp,
  SEARCH_RATE_LIMIT,
} from "@/lib/ratelimit";
import { apiError } from "@/lib/errors";
import {
  cacheGet,
  cacheSet,
  searchCacheKey,
} from "@/lib/cache";
import { normalizePlace, type SerpApiLocalResult } from "@/lib/normalize";
import { meanRatingOf, scorePlace } from "@/lib/score";
import { searchPlaces, SerpApiError } from "@/lib/serpapi";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const SEARCH_CACHE_TTL_SEC = 10 * 60;
const MAX_RESULTS = 20;

/** Words that carry no matching signal in mock mode. */
const STOPWORDS = new Set([
  "open", "now", "near", "me", "best", "cheap", "cheapest", "the",
  "a", "an", "to", "in", "at", "for", "and", "of", "late", "is", "are",
]);

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

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = null;
  }

  const parsed = SearchRequestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("INVALID_INPUT", "Check your search and try again", 400);
  }
  const { query, lat, lng, radiusKm } = parsed.data;

  const rl = checkRateLimit(
    getClientIp(req),
    SEARCH_RATE_LIMIT.limit,
    SEARCH_RATE_LIMIT.windowMs
  );
  if (!rl.allowed) {
    return apiError(
      "RATE_LIMITED",
      "Too many searches, wait a minute",
      429,
      rl.retryAfterSec
    );
  }

  const normalizedQuery = query.trim().toLowerCase().replace(/\s+/g, " ");
  const key = searchCacheKey(normalizedQuery, lat, lng, radiusKm);

  const hit = await cacheGet<{ places: Place[]; mock: boolean }>(key);
  if (hit) {
    return NextResponse.json({
      cached: true,
      count: hit.places.length,
      places: hit.places,
      mock: hit.mock,
    });
  }

  let rawItems: SerpApiLocalResult[];
  let mock = false;

  if (useMock()) {
    mock = true;
    rawItems = filterMock(await loadMockResults(), normalizedQuery);
  } else {
    const apiKey = process.env.SERPAPI_KEY;
    if (!apiKey) {
      return apiError(
        "UPSTREAM_ERROR",
        "Couldn't reach the places service",
        502
      );
    }
    try {
      rawItems = (await searchPlaces({
        q: query,
        lat,
        lng,
        radiusKm,
        apiKey,
      })) as SerpApiLocalResult[];
    } catch (err) {
      if (err instanceof SerpApiError && err.code === "QUOTA_EXCEEDED") {
        return apiError("QUOTA_EXCEEDED", "Search is busy right now", 503);
      }
      return apiError(
        "UPSTREAM_ERROR",
        "Couldn't reach the places service",
        502
      );
    }
  }

  const origin = { lat, lng };
  const normalized: Place[] = [];
  for (const item of rawItems) {
    const place = normalizePlace(item, origin);
    if (place) normalized.push(place); // null = permanently closed, excluded
  }

  const meanRating = meanRatingOf(normalized);
  const scored = normalized
    .map((p) => ({ ...p, score: scorePlace(p, radiusKm, meanRating) }))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, MAX_RESULTS);

  await cacheSet(key, { places: scored, mock }, SEARCH_CACHE_TTL_SEC);
  logSearch({ query: normalizedQuery, lat, lng, radiusKm, results: scored.length, cached: false });

  return NextResponse.json({
    cached: false,
    count: scored.length,
    places: scored,
    mock,
  });
}
