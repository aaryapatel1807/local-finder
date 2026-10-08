/**
 * GET /api/place/[id] — full details for one place.
 *
 * Served from the search cache when possible (spec 8.2), so it usually
 * costs no SerpApi call. 404 NOT_FOUND when the id isn't cached.
 */

import { NextRequest, NextResponse } from "next/server";
import { findCachedPlace } from "@/lib/cache";
import { apiError } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const place = findCachedPlace(params.id);
  if (!place) {
    return apiError("NOT_FOUND", "Place not found", 404);
  }
  return NextResponse.json({ place });
}
