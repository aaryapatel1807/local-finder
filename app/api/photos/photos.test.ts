/**
 * API tests for GET /api/photos.
 * Mock mode (USE_MOCK=true) returns the empty gallery without SerpApi.
 * The live quota guard is tested via the usage counter (tiny limit).
 */
import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";
import { clearMemoryCache } from "@/lib/cache";
import { clearRateLimits } from "@/lib/ratelimit";
import {
  incrementCalls,
  resetUsageForTests,
  getMonthlyLimit,
} from "@/lib/usage";

let ipCounter = 400;
function photosRequest(dataId: string | null): NextRequest {
  ipCounter += 1;
  const url =
    dataId === null
      ? "http://localhost/api/photos"
      : `http://localhost/api/photos?dataId=${encodeURIComponent(dataId)}`;
  return new NextRequest(url, {
    method: "GET",
    headers: { "x-forwarded-for": `10.4.0.${ipCounter}` },
  });
}

beforeEach(() => {
  clearMemoryCache();
  clearRateLimits();
  resetUsageForTests();
  vi.stubEnv("USE_MOCK", "true");
  vi.stubEnv("MONTHLY_CALL_LIMIT", "");
  vi.stubEnv("SERPAPI_KEY", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /api/photos", () => {
  it("returns an empty gallery with mock: true in mock mode (no SerpApi)", async () => {
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);
    const res = await GET(photosRequest("some-data-id"));
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      photos: unknown[];
      mock: boolean;
    };
    expect(json.photos).toEqual([]);
    expect(json.mock).toBe(true);
    expect(spy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("returns mock: true when SERPAPI_KEY is missing even outside mock mode", async () => {
    vi.stubEnv("USE_MOCK", "false");
    const res = await GET(photosRequest("some-data-id"));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { photos: unknown[]; mock: boolean };
    expect(json.photos).toEqual([]);
    expect(json.mock).toBe(true);
  });

  it("rejects a missing dataId with 400 INVALID_INPUT", async () => {
    const res = await GET(photosRequest(null));
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: { code: string } };
    expect(json.error.code).toBe("INVALID_INPUT");
  });

  it("returns 503 QUOTA_NEAR_LIMIT when usage is >= 90% of the limit", async () => {
    vi.stubEnv("USE_MOCK", "false");
    vi.stubEnv("SERPAPI_KEY", "test-key");
    vi.stubEnv("MONTHLY_CALL_LIMIT", "10");
    expect(getMonthlyLimit()).toBe(10);
    await incrementCalls(9); // 9 >= 10 * 0.9
    const res = await GET(photosRequest("some-data-id"));
    expect(res.status).toBe(503);
    const json = (await res.json()) as { error: { code: string } };
    expect(json.error.code).toBe("QUOTA_NEAR_LIMIT");
  });
});
