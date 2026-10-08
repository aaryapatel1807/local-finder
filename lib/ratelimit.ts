/**
 * Per-IP in-memory sliding-window rate limiter.
 *
 * 20 searches/hour per IP, 10/hour for the AI routes (parse, reviews).
 * In-memory means the window is per server instance — good enough for the
 * free tier; the failure mode is "slightly generous", never "blocks users".
 */

export type RateLimitResult = {
  allowed: boolean;
  /** Seconds to wait before retrying (0 when allowed). */
  retryAfterSec: number;
};

const buckets = new Map<string, number[]>();

function prune(timestamps: number[], windowStart: number): number[] {
  // timestamps are appended in chronological order, so a linear scan from
  // the front is fine for these tiny windows.
  let i = 0;
  while (i < timestamps.length && timestamps[i] <= windowStart) i++;
  return timestamps.slice(i);
}

/**
 * Sliding-window check. Returns { allowed, retryAfterSec }.
 *
 * @param key bucket key (usually the client IP)
 * @param limit max requests in the window
 * @param windowMs window length in milliseconds
 * @param now injectable clock (for tests)
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now()
): RateLimitResult {
  const windowStart = now - windowMs;
  const kept = prune(buckets.get(key) ?? [], windowStart);

  if (kept.length >= limit) {
    const oldest = kept[0];
    const retryAfterSec = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    buckets.set(key, kept);
    return { allowed: false, retryAfterSec };
  }

  kept.push(now);
  buckets.set(key, kept);
  return { allowed: true, retryAfterSec: 0 };
}

/** Test helper: reset all buckets. */
export function clearRateLimits(): void {
  buckets.clear();
}

/**
 * Best-effort client IP: first entry of x-forwarded-for, falling back to
 * 'unknown' (still rate-limited, just shared by all unknown clients).
 */
export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}

/** Convenience limits from the spec. */
export const SEARCH_RATE_LIMIT = { limit: 20, windowMs: 60 * 60 * 1000 };
export const AI_RATE_LIMIT = { limit: 10, windowMs: 60 * 60 * 1000 };
