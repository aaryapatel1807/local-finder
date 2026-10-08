/**
 * Shared raw-review fetching, extracted from POST /api/reviews.
 *
 * getReviewsCached(dataId) returns the raw review snippets for one place
 * (plus the hand-written mock summary when in mock mode), cached 24h.
 * Reused by /api/reviews (summarization) and /api/ask (Q&A) so both read
 * the same source without extra SerpApi calls.
 *
 * In mock mode (USE_MOCK=true, default) no SerpApi call is made and no
 * quota is spent. Live mode throws SerpApiError on upstream failure
 * (callers map QUOTA_EXCEEDED -> 503, everything else -> 502).
 */

import { readFile } from "fs/promises";
import path from "path";
import { cacheGet, cacheSet } from "./cache";
import { fetchReviews, SerpApiError } from "./serpapi";

/** One raw review snippet, as SerpApi returns it (subset we care about). */
export type RawReview = {
  snippet?: string;
  text?: string;
  rating?: number | string;
  date?: string;
};

/** Hand-written summary shipped with mock entries (zero AI cost). */
export type MockSummary = {
  summary: string;
  pros: string[];
  cons: string[];
  tags?: string[];
  sentiment?: number;
  bestTimeHint?: string;
};

export type ReviewsSource = {
  reviews: RawReview[];
  mock: boolean;
  placeName?: string;
  /** Present only for mock entries that ship a hand-written summary. */
  mockSummary?: MockSummary;
};

const RAW_REVIEWS_TTL_SEC = 24 * 60 * 60; // 24h

/** Cache key for raw review snippets. */
export function rawReviewsCacheKey(dataId: string): string {
  return `rawreviews:${dataId}`;
}

function useMock(): boolean {
  return process.env.USE_MOCK !== "false"; // default true
}

type MockReviewsFile = {
  reviews_by_data_id?: Record<
    string,
    {
      place_name?: string;
      reviews?: { snippet?: string; rating?: number; date?: string }[];
      summary?: string;
      pros?: string[];
      cons?: string[];
      tags?: string[];
      sentiment?: number;
      bestTimeHint?: string;
    }
  >;
};

async function loadMockSource(dataId: string): Promise<ReviewsSource> {
  const file = path.join(process.cwd(), "mock", "reviews.json");
  const json = JSON.parse(await readFile(file, "utf8")) as MockReviewsFile;
  const entry = json.reviews_by_data_id?.[dataId];
  if (!entry) {
    return { reviews: [], mock: true };
  }
  const source: ReviewsSource = {
    reviews: (entry.reviews ?? []).map((r) => ({
      snippet: r.snippet,
      rating: r.rating,
      date: r.date,
    })),
    mock: true,
    placeName: entry.place_name,
  };
  if (entry.summary) {
    const mockSummary: MockSummary = {
      summary: entry.summary,
      pros: entry.pros ?? [],
      cons: entry.cons ?? [],
    };
    if (entry.tags) mockSummary.tags = entry.tags;
    if (typeof entry.sentiment === "number") {
      mockSummary.sentiment = entry.sentiment;
    }
    if (entry.bestTimeHint) mockSummary.bestTimeHint = entry.bestTimeHint;
    source.mockSummary = mockSummary;
  }
  return source;
}

/**
 * Fetch raw reviews for one place, cached 24h. Mock mode never touches
 * SerpApi. Live mode throws SerpApiError on upstream failure.
 */
export async function getReviewsCached(
  dataId: string
): Promise<ReviewsSource> {
  const key = rawReviewsCacheKey(dataId);
  const hit = await cacheGet<ReviewsSource>(key);
  if (hit) return hit;

  let source: ReviewsSource;
  if (useMock()) {
    source = await loadMockSource(dataId);
  } else {
    const apiKey = process.env.SERPAPI_KEY;
    if (!apiKey) {
      throw new Error("SERPAPI_KEY is not set");
    }
    let raw: Record<string, unknown>[];
    try {
      raw = await fetchReviews({ dataId, apiKey });
    } catch (err) {
      if (err instanceof SerpApiError) throw err;
      throw new SerpApiError(
        "UPSTREAM_ERROR",
        err instanceof Error ? err.message : "Upstream request failed"
      );
    }
    source = {
      reviews: raw.map((r) => ({
        snippet: typeof r["snippet"] === "string" ? (r["snippet"] as string) : undefined,
        text: typeof r["text"] === "string" ? (r["text"] as string) : undefined,
        rating: r["rating"] as number | string | undefined,
        date: typeof r["date"] === "string" ? (r["date"] as string) : undefined,
      })),
      mock: false,
    };
  }

  await cacheSet(key, source, RAW_REVIEWS_TTL_SEC);
  return source;
}
