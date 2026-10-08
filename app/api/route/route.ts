/**
 * GET /api/route?from=lat,lng&to=lat,lng&mode=walk|drive — directions.
 *
 * Response: 200 { durationMin, distanceKm, mode, estimated, cached }
 *           400 INVALID_INPUT | 429 RATE_LIMITED.
 *
 * OSRM demo server (keyless, ₹0) is tried first; when it is unreachable
 * or fails, a haversine estimate is returned instead
 * ({ estimated: true }) — valid input never 503s. Estimates are not
 * cached, so a later request can pick up a real OSRM route on recovery.
 * Cached 24h (real routes only).
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit, getClientIp, SEARCH_RATE_LIMIT } from "@/lib/ratelimit";
import { apiError } from "@/lib/errors";
import { cacheGet, cacheSet } from "@/lib/cache";
import {
  ROUTE_CACHE_TTL_SEC,
  computeRoute,
  haversineEstimate,
  parseLatLng,
  routeCacheKey,
  type RouteResult,
} from "@/lib/directions";

export const dynamic = "force-dynamic";

const RouteQuerySchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  mode: z.enum(["walk", "drive"]).default("walk"),
});

export async function GET(req: NextRequest): Promise<NextResponse> {
  const raw = {
    from: req.nextUrl.searchParams.get("from") ?? "",
    to: req.nextUrl.searchParams.get("to") ?? "",
    mode: req.nextUrl.searchParams.get("mode") ?? undefined,
  };

  const parsed = RouteQuerySchema.safeParse(raw);
  if (!parsed.success) {
    return apiError("INVALID_INPUT", "Check your search and try again", 400);
  }

  const from = parseLatLng(parsed.data.from);
  const to = parseLatLng(parsed.data.to);
  if (!from || !to) {
    return apiError("INVALID_INPUT", "from/to must be lat,lng", 400);
  }
  const mode = parsed.data.mode;

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

  const key = routeCacheKey(mode, from, to);
  const hit = await cacheGet<RouteResult>(key);
  if (hit) return NextResponse.json({ ...hit, cached: true });

  try {
    const result = await computeRoute(from, to, mode);
    await cacheSet(key, result, ROUTE_CACHE_TTL_SEC);
    return NextResponse.json({ ...result, cached: false });
  } catch {
    // ANY OSRM/network failure -> haversine estimate (never cached).
    const estimated = haversineEstimate(from, to, mode);
    return NextResponse.json({ ...estimated, cached: false });
  }
}
