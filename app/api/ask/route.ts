/**
 * POST /api/ask — answer a question about a place from its reviews.
 *
 * Request:  { dataId?, placeName, question }
 * Response: 200 { answer: string | null, basedOn: number, cached? }
 *           400 INVALID_INPUT | 429 RATE_LIMITED.
 *
 * Groq answers using ONLY the fetched review snippets — same
 * prompt-injection guardrails as summarizeReviews (fenced block, reviews
 * treated as data, instructions inside ignored). Raw snippets come from
 * the shared getReviewsCached() helper (no extra SerpApi calls).
 *
 * 24h cache keyed by a hash of dataId + question. AI disabled or ANY
 * failure -> { answer: null } (never 500).
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  checkRateLimit,
  getClientIp,
  AI_RATE_LIMIT,
} from "@/lib/ratelimit";
import { apiError } from "@/lib/errors";
import { askCacheKey, cacheGet, cacheSet } from "@/lib/cache";
import { getReviewsCached } from "@/lib/reviews";
import { answerFromReviews, isAiEnabled } from "@/lib/ai";

export const dynamic = "force-dynamic";

const ASK_CACHE_TTL_SEC = 24 * 60 * 60; // 24h

const AskRequestSchema = z.object({
  dataId: z.string().min(1).max(200).optional(),
  placeName: z.string().min(1, "placeName is required").max(120),
  question: z.string().min(1, "question is required").max(300),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = null;
  }

  const parsed = AskRequestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("INVALID_INPUT", "Check your question and try again", 400);
  }
  const { dataId, placeName, question } = parsed.data;

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

  if (!isAiEnabled()) {
    return NextResponse.json({ answer: null });
  }

  try {
    // No dataId -> no reviews to answer from.
    if (!dataId) {
      return NextResponse.json({ answer: null, basedOn: 0 });
    }

    const key = askCacheKey(dataId, question);
    const hit = await cacheGet<{ answer: string | null; basedOn: number }>(key);
    if (hit) {
      return NextResponse.json({ ...hit, cached: true });
    }

    const source = await getReviewsCached(dataId);
    const { answer, basedOn } = await answerFromReviews(
      source.reviews.map((r) => ({
        snippet: r.snippet,
        text: r.text,
        rating: r.rating,
        date: r.date,
      })),
      source.placeName ?? placeName,
      question
    );

    const result = { answer, basedOn };
    await cacheSet(key, result, ASK_CACHE_TTL_SEC);
    return NextResponse.json({ ...result, cached: false });
  } catch {
    // ANY failure -> { answer: null }, never 500.
    return NextResponse.json({ answer: null });
  }
}
