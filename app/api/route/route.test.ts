/**
 * API tests for GET /api/route (mocked fetch — no OSRM calls).
 * Follows the app/api/search/search.test.ts request patterns.
 */
import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";
import { haversineEstimate, parseLatLng } from "@/lib/directions";
import { clearMemoryCache } from "@/lib/cache";
import { clearRateLimits } from "@/lib/ratelimit";

let ipCounter = 100;
function routeRequest(params: string): NextRequest {
  ipCounter += 1;
  return new NextRequest(`http://localhost/api/route?${params}`, {
    method: "GET",
    headers: { "x-forwarded-for": `10.1.0.${ipCounter}` },
  });
}

const FROM = "22.3072,73.1812";
const TO = "22.312,73.19";

function mockOsrm(durationSec: number, distanceM: number) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ routes: [{ duration: durationSec, distance: distanceM }] }),
    })
  );
}

beforeEach(() => {
  clearMemoryCache();
  clearRateLimits();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("parseLatLng", () => {
  it("parses valid lat,lng", () => {
    expect(parseLatLng("22.3072,73.1812")).toEqual({ lat: 22.3072, lng: 73.1812 });
  });

  it("rejects malformed or out-of-range input", () => {
    expect(parseLatLng("")).toBeNull();
    expect(parseLatLng("22.3")).toBeNull();
    expect(parseLatLng("abc,def")).toBeNull();
    expect(parseLatLng("95,73")).toBeNull(); // lat > 90
    expect(parseLatLng("22,190")).toBeNull(); // lng > 180
  });
});

describe("GET /api/route", () => {
  it("returns drive duration/distance from the OSRM response", async () => {
    mockOsrm(600, 2500); // 10 min, 2.5 km
    const res = await GET(routeRequest(`from=${FROM}&to=${TO}&mode=drive`));
    expect(res.status).toBe(200);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json.durationMin).toBe(10);
    expect(json.distanceKm).toBe(2.5);
    expect(json.mode).toBe("drive");
    expect(json.estimated).toBe(false);
    expect(json.cached).toBe(false);
  });

  it("derives walk minutes from distance (OSRM demo has no foot profile)", async () => {
    mockOsrm(600, 2500); // 2.5 km -> 2.5/5*60 = 30 min
    const res = await GET(routeRequest(`from=${FROM}&to=${TO}&mode=walk`));
    expect(res.status).toBe(200);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json.durationMin).toBe(30);
    expect(json.distanceKm).toBe(2.5);
    expect(json.mode).toBe("walk");
  });

  it("defaults mode to walk", async () => {
    mockOsrm(600, 2500);
    const res = await GET(routeRequest(`from=${FROM}&to=${TO}`));
    const json = (await res.json()) as { mode: string };
    expect(json.mode).toBe("walk");
  });

  it("serves the second identical call from cache without refetching", async () => {
    mockOsrm(600, 2500);
    const params = `from=${FROM}&to=${TO}&mode=drive`;
    const first = await GET(routeRequest(params));
    expect((await first.json()) as { cached: boolean }).toMatchObject({
      cached: false,
    });

    const req = new NextRequest(`http://localhost/api/route?${params}`, {
      method: "GET",
      headers: { "x-forwarded-for": "10.1.0.100" },
    });
    const second = await GET(req);
    const json = (await second.json()) as { cached: boolean; durationMin: number };
    expect(json.cached).toBe(true);
    expect(json.durationMin).toBe(10);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("falls back to a haversine estimate (200, estimated: true) when OSRM fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("boom")));
    const res = await GET(routeRequest(`from=${FROM}&to=${TO}&mode=drive`));
    expect(res.status).toBe(200);
    const json = (await res.json()) as Record<string, unknown>;
    const expected = haversineEstimate(
      { lat: 22.3072, lng: 73.1812 },
      { lat: 22.312, lng: 73.19 },
      "drive"
    );
    expect(json.estimated).toBe(true);
    expect(json.durationMin).toBe(expected.durationMin);
    expect(json.distanceKm).toBe(expected.distanceKm);
    expect(json.mode).toBe("drive");
  });

  it("estimates walk minutes from haversine distance when OSRM is unusable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ routes: [] }) })
    );
    const res = await GET(routeRequest(`from=${FROM}&to=${TO}&mode=walk`));
    expect(res.status).toBe(200);
    const json = (await res.json()) as Record<string, unknown>;
    const expected = haversineEstimate(
      { lat: 22.3072, lng: 73.1812 },
      { lat: 22.312, lng: 73.19 },
      "walk"
    );
    expect(json.estimated).toBe(true);
    expect(json.durationMin).toBe(expected.durationMin);
    // walk estimate is slower than the drive estimate over the same distance
    const drive = haversineEstimate(
      { lat: 22.3072, lng: 73.1812 },
      { lat: 22.312, lng: 73.19 },
      "drive"
    );
    expect(expected.durationMin).toBeGreaterThan(drive.durationMin);
  });

  it("falls back to an estimate on non-OK OSRM status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) })
    );
    const res = await GET(routeRequest(`from=${FROM}&to=${TO}`));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { estimated: boolean };
    expect(json.estimated).toBe(true);
  });

  it("does not cache estimates: a retry hits OSRM again", async () => {
    const spy = vi.fn().mockRejectedValue(new Error("boom"));
    vi.stubGlobal("fetch", spy);
    const params = `from=${FROM}&to=${TO}&mode=drive`;
    await GET(routeRequest(params));
    await GET(routeRequest(params));
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("rejects invalid from/to with 400 INVALID_INPUT", async () => {
    for (const params of [
      `from=&to=${TO}`,
      `from=abc&to=${TO}`,
      `from=${FROM}&to=95,73`,
      `from=${FROM}&to=${TO}&mode=fly`,
    ]) {
      const res = await GET(routeRequest(params));
      expect(res.status).toBe(400);
      const json = (await res.json()) as { error: { code: string } };
      expect(json.error.code).toBe("INVALID_INPUT");
    }
  });
});
