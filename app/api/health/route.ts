/**
 * GET /api/health — uptime + quota check (spec 8.6).
 * Response: { ok: true, mock: <bool>, callsThisMonth: <number> }.
 */

import { NextResponse } from "next/server";
import { getCallsThisMonth } from "@/lib/usage";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    ok: true,
    mock: process.env.USE_MOCK !== "false",
    callsThisMonth: await getCallsThisMonth(),
  });
}
