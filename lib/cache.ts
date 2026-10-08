/**
 * Two-level cache: in-memory Map (L1) + optional Upstash Redis via REST (L2).
 *
 * Upstash is used only when both UPSTASH_REDIS_REST_URL and
 * UPSTASH_REDIS_REST_TOKEN are set — via plain fetch, no SDK needed.
 * Every Redis call is wrapped in try/catch so a Redis outage silently
 * falls back to the in-memory cache; a broken cache must never break
 * a search.
 */

import type { Place } from "./schemas";

type Entry = { value: string; expiresAt: number };

const mem = new Map<string, Entry>();

function upstashEnabled(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  );
}

/** Minimal Upstash REST call: GET/SET/DEL/SETEX via URL path segments. */
async function upstashCall(path: string): Promise<unknown> {
  const url = process.env.UPSTASH_REDIS_REST_URL!.replace(/\/$/, "");
  const res = await fetch(`${url}/${path}`, {
    headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` },
  });
  if (!res.ok) throw new Error(`upstash ${res.status}`);
  const json = (await res.json()) as { result?: unknown };
  return json.result ?? null;
}

/**
 * Cache key for a search (spec 7.2): coordinates rounded to 3 decimals
 * (~110 m) so nearby users share entries.
 */
export function searchCacheKey(
  normalizedQuery: string,
  lat: number,
  lng: number,
  radiusKm: number
): string {
  return `search:${normalizedQuery}:${lat.toFixed(3)}:${lng.toFixed(3)}:${radiusKm}`;
}

/** Cache key for review summaries. */
export function reviewsCacheKey(dataId: string): string {
  return `reviews:${dataId}`;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const now = Date.now();

  const hit = mem.get(key);
  if (hit) {
    if (hit.expiresAt > now) {
      try {
        return JSON.parse(hit.value) as T;
      } catch {
        mem.delete(key);
      }
    } else {
      mem.delete(key);
    }
  }

  if (upstashEnabled()) {
    try {
      const result = await upstashCall(`GET/${encodeURIComponent(key)}`);
      if (typeof result === "string" && result) {
        const parsed = JSON.parse(result) as T;
        // Backfill L1 so repeat reads are cheap (best-effort TTL unknown;
        // keep it short).
        mem.set(key, { value: result, expiresAt: now + 60_000 });
        return parsed;
      }
    } catch {
      // fall through to null — Redis failure is never fatal
    }
  }

  return null;
}

export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds: number
): Promise<void> {
  const serialized = JSON.stringify(value);
  mem.set(key, { value: serialized, expiresAt: Date.now() + ttlSeconds * 1000 });

  if (upstashEnabled()) {
    try {
      await upstashCall(
        `SET/${encodeURIComponent(key)}/${encodeURIComponent(serialized)}/EX/${ttlSeconds}`
      );
    } catch {
      // silent fallback to memory
    }
  }
}

export async function cacheDel(key: string): Promise<void> {
  mem.delete(key);
  if (upstashEnabled()) {
    try {
      await upstashCall(`DEL/${encodeURIComponent(key)}`);
    } catch {
      // silent
    }
  }
}

/** Test helper: clear the in-memory layer. */
export function clearMemoryCache(): void {
  mem.clear();
}

/**
 * Best-effort lookup of a single place across cached search results.
 * Used by GET /api/place/[id] so details cost no SerpApi call.
 * Only scans the in-memory layer (Upstash scans would need SCAN support).
 */
export function findCachedPlace(id: string): Place | null {
  const now = Date.now();
  let found: Place | null = null;
  mem.forEach((entry, key) => {
    if (found) return;
    if (!key.startsWith("search:")) return;
    if (entry.expiresAt <= now) return;
    try {
      const cached = JSON.parse(entry.value) as { places?: Place[] };
      const match = cached.places?.find((p) => p.id === id);
      if (match) found = match;
    } catch {
      // ignore corrupt entries
    }
  });
  return found;
}
