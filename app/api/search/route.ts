/**
 * POST /api/search — nearby place search.
 *
 * Thin wrapper: validation + rate limit live here, the pipeline lives in
 * lib/searchPipeline.ts (shared with /api/answer).
 *
 * Response: { cached, count, places, mock }
 *           400 INVALID_INPUT | 429 RATE_LIMITED | 502 UPSTREAM_ERROR |
 *           503 QUOTA_EXCEEDED.
 */

import { NextRequest, NextResponse } from "next/server";
import { SearchRequestSchema } from "@/lib/schemas";
import {
  checkRateLimit,
  getClientIp,
  SEARCH_RATE_LIMIT,
} from "@/lib/ratelimit";
import { apiError } from "@/lib/errors";
import { searchPlaces } from "@/lib/searchPipeline";
import { SerpApiError } from "@/lib/serpapi";

export const dynamic = "force-dynamic";

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

  try {
    const { places, cached, mock } = await searchPlaces({
      query,
      lat,
      lng,
      radiusKm,
    });
    return NextResponse.json({
      cached,
      count: places.length,
      places,
      mock,
    });
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
