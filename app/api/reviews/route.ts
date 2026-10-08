/**
 * POST /api/reviews — AI review summary for one place (spec 8.3).
 *
 * Request:  { dataId, placeName }
 * Response: { summary, pros, cons, basedOn, tags?, sentiment?,
 *             bestTimeHint?, cached, mock?, aiDisabled? }
 *
 * Raw snippets come from the shared getReviewsCached() helper (24h raw
 * cache, also used by /api/ask). The summary itself is cached 24h. In
 * mock mode the summary is the hand-written mock entry — no Groq call,
 * no SerpApi call. Live mode summarizes with Groq; any AI failure hides
 * the feature ({ summary: null }) but still returns 200.
 */

import { NextRequest, NextResponse } from "next/server";
import { ReviewsRequestSchema, type ReviewSummary } from "@/lib/schemas";
import {
  checkRateLimit,
  getClientIp,
  AI_RATE_LIMIT,
} from "@/lib/ratelimit";
import { apiError } from "@/lib/errors";
import { cacheGet, cacheSet, reviewsCacheKey } from "@/lib/cache";
import { SerpApiError } from "@/lib/serpapi";
import { getReviewsCached, type MockSummary } from "@/lib/reviews";
import {
  isAiEnabled,
  summarizeReviews,
  type ReviewInput,
} from "@/lib/ai";

export const dynamic = "force-dynamic";

const REVIEWS_CACHE_TTL_SEC = 24 * 60 * 60;

type CachedReviews = ReviewSummary & { aiDisabled?: boolean };

/** Merge optional mock-entry fields without emitting undefined keys. */
function withOptional(
  base: CachedReviews,
  ms: MockSummary
): CachedReviews {
  const out: CachedReviews = { ...base };
  if (ms.tags) out.tags = ms.tags;
  if (typeof ms.sentiment === "number") out.sentiment = ms.sentiment;
  if (ms.bestTimeHint) out.bestTimeHint = ms.bestTimeHint;
  return out;
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

  let source;
  try {
    source = await getReviewsCached(dataId);
  } catch (err) {
    if (err instanceof SerpApiError && err.code === "QUOTA_EXCEEDED") {
      return apiError("QUOTA_EXCEEDED", "Search is busy right now", 503);
    }
    return apiError("UPSTREAM_ERROR", "Couldn't reach the places service", 502);
  }

  const mock = source.mock;
  let result: CachedReviews;

  if (mock) {
    // Mock mode never calls Groq — hand-written summary, zero cost.
    const ms = source.mockSummary;
    result = ms
      ? withOptional(
          {
            summary: ms.summary,
            pros: ms.pros,
            cons: ms.cons,
            basedOn: source.reviews.length,
          },
          ms
        )
      : { summary: "", pros: [], cons: [], basedOn: 0 };
  } else {
    const reviews: ReviewInput[] = source.reviews.map((r) => ({
      snippet: r.snippet,
      text: r.text,
      rating: r.rating,
      date: r.date,
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
