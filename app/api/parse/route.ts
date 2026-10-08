/**
 * POST /api/parse — AI query parsing (spec 8.4).
 *
 * Request:  { text }
 * Response: { parsed: ParsedQuery | null, canonicalKey, cached, aiDisabled?, fallbackQuery? }
 *
 * `canonicalKey` maps spelling variants / transliterations to one English
 * key ("davakhana" -> "pharmacy") so /api/search can share a single cached
 * SerpApi call across variants (quota-minimal architecture).
 *
 * Parse results are cached 24h keyed by normalized input text — the AI
 * call happens at most once per distinct query. No SerpApi quota is spent
 * here. When the AI key is missing the feature degrades: the raw text is
 * returned as the fallback query so the frontend can run a normal search.
 */

import { NextRequest, NextResponse } from "next/server";
import { ParseRequestSchema, type ParsedQuery } from "@/lib/schemas";
import {
  checkRateLimit,
  getClientIp,
  AI_RATE_LIMIT,
} from "@/lib/ratelimit";
import { apiError } from "@/lib/errors";
import { cacheGet, cacheSet } from "@/lib/cache";
import { canonicalKey } from "@/lib/canonical";
import { isAiEnabled, parseQuery } from "@/lib/ai";

export const dynamic = "force-dynamic";

const PARSE_CACHE_TTL_SEC = 24 * 60 * 60; // 24h

function parseCacheKey(text: string): string {
  return `parse:${text.trim().toLowerCase().replace(/\s+/g, " ")}`;
}

type ParsePayload = {
  parsed: ParsedQuery | null;
  canonicalKey: string;
  cached: boolean;
  aiDisabled?: boolean;
  fallbackQuery?: string;
};

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

  const key = parseCacheKey(text);
  const hit = await cacheGet<ParsePayload>(key);
  if (hit) {
    return NextResponse.json({ ...hit, cached: true });
  }

  const build = (
    partial: Omit<ParsePayload, "canonicalKey" | "cached">
  ): ParsePayload => ({
    ...partial,
    canonicalKey: canonicalKey(partial.parsed?.query ?? partial.fallbackQuery ?? text),
    cached: false,
  });

  if (!isAiEnabled()) {
    const payload = build({
      parsed: null,
      aiDisabled: true,
      fallbackQuery: text,
    });
    await cacheSet(key, payload, PARSE_CACHE_TTL_SEC);
    return NextResponse.json(payload);
  }

  try {
    const result = await parseQuery(text);
    const payload = build({ parsed: result });
    await cacheSet(key, payload, PARSE_CACHE_TTL_SEC);
    return NextResponse.json(payload);
  } catch {
    const payload = build({ parsed: null, fallbackQuery: text });
    await cacheSet(key, payload, PARSE_CACHE_TTL_SEC);
    return NextResponse.json(payload);
  }
}
