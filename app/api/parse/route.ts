/**
 * POST /api/parse — AI query parsing (spec 8.4).
 *
 * Request:  { text }
 * Response: { parsed: ParsedQuery | null, cached: false, aiDisabled?, fallbackQuery? }
 *
 * No SerpApi quota is spent here. When the AI key is missing the feature
 * degrades: the raw text is returned as the fallback query so the frontend
 * can run a normal search.
 */

import { NextRequest, NextResponse } from "next/server";
import { ParseRequestSchema } from "@/lib/schemas";
import {
  checkRateLimit,
  getClientIp,
  AI_RATE_LIMIT,
} from "@/lib/ratelimit";
import { apiError } from "@/lib/errors";
import { isAiEnabled, parseQuery } from "@/lib/ai";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = null;
  }

  const parsed = ParseRequestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("INVALID_INPUT", "Check your search and try again", 400);
  }
  const { text } = parsed.data;

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
    return NextResponse.json({
      parsed: null,
      aiDisabled: true,
      fallbackQuery: text,
    });
  }

  try {
    const result = await parseQuery(text);
    return NextResponse.json({ parsed: result, cached: false });
  } catch {
    return NextResponse.json({ parsed: null, fallbackQuery: text });
  }
}
