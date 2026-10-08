/**
 * GET /api/geocode?q=<place name> — keyless forward geocoding via Photon.
 *
 * Response: 200 { lat, lng, label } | 404 { error: { code: "NO_RESULTS" } }
 *           | 400 INVALID_INPUT | 429 RATE_LIMITED.
 *
 * No API key, no SerpApi quota. Results are cached 7 days in lib/geocode.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit, getClientIp, SEARCH_RATE_LIMIT } from "@/lib/ratelimit";
import { apiError } from "@/lib/errors";
import { geocodePlace } from "@/lib/geocode";

export const dynamic = "force-dynamic";

const GeocodeQuerySchema = z.object({
  q: z.string().min(1, "q is required").max(200),
});

export async function GET(req: NextRequest): Promise<NextResponse> {
  const parsed = GeocodeQuerySchema.safeParse({
    q: req.nextUrl.searchParams.get("q") ?? "",
  });
  if (!parsed.success) {
    return apiError("INVALID_INPUT", "A search term (q) is required", 400);
  }

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

  const result = await geocodePlace(parsed.data.q);
  if (!result) {
    return apiError("NO_RESULTS", "No location found for that search", 404);
  }
  return NextResponse.json(result);
}
