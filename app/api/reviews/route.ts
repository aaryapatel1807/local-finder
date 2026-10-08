/**
 * POST /api/reviews — AI review summary for one place (spec 8.3).
 *
 * Request:  { dataId, placeName }
 * Response: { summary, pros, cons, basedOn, cached, mock?, aiDisabled? }
 *
 * Cached 24h. In mock mode the summary comes from mock/reviews.json —
 * no Groq call, no SerpApi call. Live mode fetches up to 10 reviews from
 * SerpApi then summarizes with Groq; any AI failure hides the feature
 * ({ summary: null }) but still returns 200.
 */

import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { ReviewsRequestSchema, type ReviewSummary } from "@/lib/schemas";
import {
  checkRateLimit,
  getClientIp,
  AI_RATE_LIMIT,
} from "@/lib/ratelimit";
import { apiError } from "@/lib/errors";
import { cacheGet, cacheSet, reviewsCacheKey } from "@/lib/cache";
import { fetchReviews, SerpApiError } from "@/lib/serpapi";
import {
  isAiEnabled,
  summarizeReviews,
  type ReviewInput,
} from "@/lib/ai";

export const dynamic = "force-dynamic";

const REVIEWS_CACHE_TTL_SEC = 24 * 60 * 60;

type CachedReviews = ReviewSummary & { aiDisabled?: boolean };

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
    }
  >;
};

async function loadMockSummary(
  dataId: string
): Promise<CachedReviews | null> {
  const file = path.join(process.cwd(), "mock", "reviews.json");
  const json = JSON.parse(await readFile(file, "utf8")) as MockReviewsFile;
  const entry = json.reviews_by_data_id?.[dataId];
  if (!entry) return null;
  return {
    summary: entry.summary ?? "",
    pros: entry.pros ?? [],
    cons: entry.cons ?? [],
    basedOn: entry.reviews?.length ?? 0,
  };
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = null;
  }

  const parsed = ReviewsRequestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("INVALID_INPUT", "Check your search and try again", 400);
  }
  const { dataId, placeName } = parsed.data;

  const rl = checkRateLimit(
    getClientIp(req),
    AI_RATE_LIMIT.limit,
    AI_RATE_LIMIT.windowMs
  );
  if (!rl.allowed) {
    return apiError(
      "RATE_LIMITED",
      "Too many requests, wait a minute",
      429,
      rl.retryAfterSec
    );
  }

  const key = reviewsCacheKey(dataId);
  const hit = await cacheGet<CachedReviews>(key);
  if (hit) {
    return NextResponse.json({ ...hit, cached: true });
  }

  let result: CachedReviews;
  let mock = false;

  if (useMock()) {
    mock = true;
    const mockSummary = await loadMockSummary(dataId);
    // Mock mode never calls Groq — hand-written summary, zero cost.
    result = mockSummary ?? { summary: "", pros: [], cons: [], basedOn: 0 };
  } else {
    const apiKey = process.env.SERPAPI_KEY;
    if (!apiKey) {
      return apiError("UPSTREAM_ERROR", "Couldn't reach the places service", 502);
    }

    let rawReviews: Record<string, unknown>[];
    try {
      rawReviews = await fetchReviews({ dataId, apiKey });
    } catch (err) {
      if (err instanceof SerpApiError && err.code === "QUOTA_EXCEEDED") {
        return apiError("QUOTA_EXCEEDED", "Search is busy right now", 503);
      }
      return apiError("UPSTREAM_ERROR", "Couldn't reach the places service", 502);
    }

    const reviews: ReviewInput[] = rawReviews.map((r) => ({
      snippet:
        typeof r["snippet"] === "string" ? (r["snippet"] as string) : undefined,
      text: typeof r["text"] === "string" ? (r["text"] as string) : undefined,
      rating: r["rating"] as number | string | undefined,
      date: typeof r["date"] === "string" ? (r["date"] as string) : undefined,
    }));

    if (!isAiEnabled()) {
      result = {
        summary: "",
        pros: [],
        cons: [],
        basedOn: reviews.length,
        aiDisabled: true,
      };
    } else {
      try {
        result = await summarizeReviews(reviews, placeName);
      } catch {
        // Hide the feature, don't break the page.
        result = { summary: "", pros: [], cons: [], basedOn: reviews.length };
      }
    }
  }

  // Only cache real summaries, not empty fallbacks.
  if (result.summary) {
    await cacheSet(key, result, REVIEWS_CACHE_TTL_SEC);
  }

  return NextResponse.json({ ...result, cached: false, mock });
}
