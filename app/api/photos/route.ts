/**
 * GET /api/photos?dataId=<place data_id> — place photo gallery.
 *
 * Response: 200 { photos: [{ url }], cached, mock? }
 *           400 INVALID_INPUT | 429 RATE_LIMITED
 *           503 QUOTA_NEAR_LIMIT when monthly SerpApi usage is >= 90% of
 *           MONTHLY_CALL_LIMIT | 503 QUOTA_EXCEEDED | 502 UPSTREAM_ERROR.
 *
 * Quota is guarded BEFORE any SerpApi call (near-limit refuses early so
 * searches keep the last of the quota). Photos are cached 24h and capped
 * at 10. USE_MOCK=true (or no SERPAPI_KEY) -> { photos: [], mock: true }
 * without calling SerpApi.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit, getClientIp, SEARCH_RATE_LIMIT } from "@/lib/ratelimit";
import { apiError } from "@/lib/errors";
import { cacheGet, cacheSet, photosCacheKey } from "@/lib/cache";
import { fetchPhotos, SerpApiError } from "@/lib/serpapi";
import { isQuotaNearLimit } from "@/lib/usage";

export const dynamic = "force-dynamic";

const PHOTOS_CACHE_TTL_SEC = 24 * 60 * 60; // 24h
const MAX_PHOTOS = 10;

const PhotosQuerySchema = z.object({
  dataId: z.string().min(1, "dataId is required").max(200),
});

export type PhotoItem = { url: string };

export async function GET(req: NextRequest): Promise<NextResponse> {
  const parsed = PhotosQuerySchema.safeParse({
    dataId: req.nextUrl.searchParams.get("dataId") ?? "",
  });
  if (!parsed.success) {
    return apiError("INVALID_INPUT", "A place id (dataId) is required", 400);
  }
  const { dataId } = parsed.data;

  const rl = checkRateLimit(
    getClientIp(req),
    SEARCH_RATE_LIMIT.limit,
    SEARCH_RATE_LIMIT.windowMs
  );
  if (!rl.allowed) {
    return apiError(
      "RATE_LIMITED",
      "Too many requests, wait a minute",
      429,
      rl.retryAfterSec
    );
  }

  // Mock mode (or no key): no SerpApi call, no quota spent.
  const apiKey = process.env.SERPAPI_KEY;
  if (process.env.USE_MOCK !== "false" || !apiKey) {
    return NextResponse.json({ photos: [], mock: true });
  }

  const key = photosCacheKey(dataId);
  const hit = await cacheGet<{ photos: PhotoItem[] }>(key);
  if (hit) {
    return NextResponse.json({ ...hit, cached: true });
  }

  // Quota guard FIRST: refuse before spending the last of the quota.
  if (await isQuotaNearLimit(0.9)) {
    return apiError(
      "QUOTA_NEAR_LIMIT",
      "Photo service is busy right now",
      503
    );
  }

  try {
    const urls = await fetchPhotos({ dataId, apiKey });
    const photos: PhotoItem[] = urls
      .slice(0, MAX_PHOTOS)
      .map((url) => ({ url }));
    await cacheSet(key, { photos }, PHOTOS_CACHE_TTL_SEC);
    return NextResponse.json({ photos, cached: false });
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
