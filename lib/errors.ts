/**
 * Error responses follow the spec 7.8 contract:
 *   { "error": { "code": "...", "message": "..." } }
 * with a matching HTTP status.
 */

import { NextResponse } from "next/server";

export type ErrorCode =
  | "INVALID_INPUT"
  | "RATE_LIMITED"
  | "QUOTA_EXCEEDED"
  | "UPSTREAM_ERROR"
  | "NOT_FOUND"
  | "NO_RESULTS"
  | "QUOTA_NEAR_LIMIT";

export function apiError(
  code: ErrorCode,
  message: string,
  status: number,
  retryAfterSec?: number
): NextResponse {
  const res = NextResponse.json({ error: { code, message } }, { status });
  if (retryAfterSec != null) {
    res.headers.set("Retry-After", String(retryAfterSec));
  }
  return res;
}
