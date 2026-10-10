/**
 * GET /api/images?name=<place name>&city=<city>
 *
 * Wikimedia Commons photo lookup — free, no key, no quota.
 * Response: 200 { image: { url, title } | null, cached }
 *           400 INVALID_INPUT
 *
 * Cached 7 days (place photos rarely change). Used by PlaceCard for OSM
 * places that have no SerpApi thumbnail.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { cacheGet, cacheSet } from "@/lib/cache";
import { findCommonsImage } from "@/lib/commons";
import { apiError } from "@/lib/errors";

export const dynamic = "force-dynamic";

const CACHE_TTL_SEC = 7 * 24 * 60 * 60; // 7 days

const QuerySchema = z.object({
  name: z.string().min(2).max(200),
  city: z.string().max(100).optional(),
});

export async function GET(req: NextRequest): Promise<NextResponse> {
  const parsed = QuerySchema.safeParse({
    name: req.nextUrl.searchParams.get("name") ?? "",
    city: req.nextUrl.searchParams.get("city") ?? undefined,
  });
  if (!parsed.success) {
    return apiError("INVALID_INPUT", "A place name is required", 400);
  }
  const { name, city } = parsed.data;
  const query = city ? `${name}, ${city}` : name;
  const key = `commons:${query.toLowerCase()}`;

  const hit = await cacheGet<{ url: string; title: string } | null>(key);
  if (hit !== null) {
    return NextResponse.json({ image: hit, cached: true });
  }

  const found = await findCommonsImage(query);
  const image = found ? { url: found.thumbUrl, title: found.title } : null;
  await cacheSet(key, image, CACHE_TTL_SEC);
  return NextResponse.json({ image, cached: false });
}
