/**
 * API tests for POST /api/search in mock mode (USE_MOCK=true).
 * These hit the real route handler with constructed NextRequests —
 * no network, no SerpApi key needed.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { clearMemoryCache } from "@/lib/cache";
import { checkRateLimit, clearRateLimits } from "@/lib/ratelimit";

process.env.USE_MOCK = "true";

let ipCounter = 0;
function searchRequest(body: unknown): NextRequest {
  ipCounter += 1;
  return new NextRequest("http://localhost/api/search", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": `10.0.0.${ipCounter}`,
    },
    body: JSON.stringify(body),
  });
}

const VALID = { query: "pharmacy", lat: 22.3072, lng: 73.1812, radiusKm: 3 };

beforeEach(() => {
  clearMemoryCache();
  clearRateLimits();
});

describe("POST /api/search (mock mode)", () => {
  it("returns { cached, count, places[] } with the expected Place shape", async () => {
    const res = await POST(searchRequest(VALID));
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      cached: boolean;
      count: number;
      places: Record<string, unknown>[];
      mock: boolean;
    };

    expect(json.cached).toBe(false);
    expect(json.mock).toBe(true);
    expect(json.count).toBe(json.places.length);
    expect(json.count).toBeGreaterThan(0);
    expect(json.count).toBeLessThanOrEqual(20);

    const p = json.places[0];
    expect(typeof p["id"]).toBe("string");
    expect(typeof p["name"]).toBe("string");
    expect(typeof p["lat"]).toBe("number");
    expect(typeof p["lng"]).toBe("number");
    expect(typeof p["distanceKm"]).toBe("number");
    expect(typeof p["score"]).toBe("number");
    expect(p["isOpen"] === null || typeof p["isOpen"] === "boolean").toBe(true);

    // Sorted by score descending.
    const scores = json.places.map((x) => x["score"] as number);
    const sorted = [...scores].sort((a, b) => b - a);
    expect(scores).toEqual(sorted);
  });

  it("serves the second identical call from cache (cached: true)", async () => {
    const first = await POST(searchRequest(VALID));
    const firstJson = (await first.json()) as { cached: boolean; count: number };
    expect(firstJson.cached).toBe(false);

    // Same IP and identical body -> cache hit.
    const req = new NextRequest("http://localhost/api/search", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "10.0.0.1",
      },
      body: JSON.stringify(VALID),
    });
    const second = await POST(req);
    const secondJson = (await second.json()) as { cached: boolean; count: number };
    expect(secondJson.cached).toBe(true);
    expect(secondJson.count).toBe(firstJson.count);
  });

  it("filters mock results by query keywords", async () => {
    const res = await POST(
      searchRequest({ ...VALID, query: "chai" })
    );
    const json = (await res.json()) as { places: { name?: string; category?: string }[] };
    expect(json.places.length).toBeGreaterThan(0);
    for (const p of json.places) {
      const hay = `${p.name ?? ""} ${p.category ?? ""}`.toLowerCase();
      expect(hay).toContain("chai");
    }
  });

  it("excludes the permanently-closed place", async () => {
    const res = await POST(searchRequest(VALID));
    const json = (await res.json()) as { places: { name?: string }[] };
    expect(
      json.places.some((p) => p.name === "Old City Medical")
    ).toBe(false);
  });

  it("returns an empty list for a query matching nothing", async () => {
    const res = await POST(searchRequest({ ...VALID, query: "xyzzyq" }));
    const json = (await res.json()) as { count: number; places: unknown[] };
    expect(res.status).toBe(200);
    expect(json.count).toBe(0);
    expect(json.places).toEqual([]);
  });

  it("rejects invalid bodies with 400 INVALID_INPUT", async () => {
    for (const body of [
      {},
      { query: "", lat: 22.3, lng: 73.18, radiusKm: 3 },
      { query: "pharmacy", lat: 200, lng: 73.18, radiusKm: 3 },
      { query: "pharmacy", lat: 22.3, lng: 73.18, radiusKm: 7 },
      { query: "x".repeat(121), lat: 22.3, lng: 73.18, radiusKm: 3 },
    ]) {
      const res = await POST(searchRequest(body));
      expect(res.status).toBe(400);
      const json = (await res.json()) as { error: { code: string } };
      expect(json.error.code).toBe("INVALID_INPUT");
    }
  });

  it("applies the per-IP rate limit (429 RATE_LIMITED)", async () => {
    const headers = {
      "content-type": "application/json",
      "x-forwarded-for": "10.9.9.9",
    };
    // 20 searches/hour allowed; the 21st is rejected.
    for (let i = 0; i < 20; i++) {
      const res = await POST(
        new NextRequest("http://localhost/api/search", {
          method: "POST",
          headers,
          body: JSON.stringify(VALID),
        })
      );
      expect(res.status).toBe(200);
    }
    const limited = await POST(
      new NextRequest("http://localhost/api/search", {
        method: "POST",
        headers,
        body: JSON.stringify(VALID),
      })
    );
    expect(limited.status).toBe(429);
    const json = (await limited.json()) as { error: { code: string } };
    expect(json.error.code).toBe("RATE_LIMITED");
  });
});

describe("checkRateLimit (unit, tiny window override)", () => {
  it("allows up to the limit, then denies with retryAfterSec", () => {
    const key = "unit-test-ip";
    expect(checkRateLimit(key, 2, 60_000).allowed).toBe(true);
    expect(checkRateLimit(key, 2, 60_000).allowed).toBe(true);
    const denied = checkRateLimit(key, 2, 60_000);
    expect(denied.allowed).toBe(false);
    expect(denied.retryAfterSec).toBeGreaterThan(0);
  });

  it("recovers after the window slides", () => {
    const key = "unit-test-ip-2";
    const t0 = Date.now();
    checkRateLimit(key, 1, 1000, t0);
    expect(checkRateLimit(key, 1, 1000, t0).allowed).toBe(false);
    expect(checkRateLimit(key, 1, 1000, t0 + 1001).allowed).toBe(true);
  });
});
