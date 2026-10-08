/**
 * Fallback-tier routing tests for lib/searchPipeline.ts (quota-minimal
 * architecture). The network fetchers are mocked; quota state is driven
 * through the real usage counters.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockSerpSearch, mockOsmSearch } = vi.hoisted(() => ({
  mockSerpSearch: vi.fn(),
  mockOsmSearch: vi.fn(),
}));

vi.mock("./serpapi", () => ({
  searchPlaces: mockSerpSearch,
  SerpApiError: class SerpApiError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

vi.mock("./osm", async (importOriginal) => {
  const orig = await importOriginal<typeof import("./osm")>();
  return { ...orig, searchOsmElements: mockOsmSearch };
});

import {
  searchPlaces,
  SEARCH_CACHE_TTL_SEC,
} from "./searchPipeline";
import { clearMemoryCache } from "./cache";
import { incrementCalls, resetUsageForTests } from "./usage";
import type { SerpApiLocalResult } from "./normalize";
import type { OsmElement } from "./osm";

const LAT = 22.3072;
const LNG = 73.1812;

function serpItem(title: string, lat = 22.31, lng = 73.18): SerpApiLocalResult {
  return {
    title,
    place_id: `sp:${title}`,
    rating: 4.4,
    reviews: 120,
    type: "Pharmacy",
    address: "MG Road",
    gps_coordinates: { latitude: lat, longitude: lng },
  };
}

function osmEl(id: number, name: string): OsmElement {
  return {
    type: "node",
    id,
    lat: 22.312,
    lon: 73.182,
    tags: { name, amenity: "pharmacy" },
  };
}

beforeEach(() => {
  clearMemoryCache();
  resetUsageForTests();
  vi.clearAllMocks();
  process.env.USE_MOCK = "false";
  delete process.env.SERPAPI_KEY;
  delete process.env.GROQ_API_KEY;
  process.env.MONTHLY_CALL_LIMIT = "200";
  mockSerpSearch.mockResolvedValue([serpItem("Serp Pharmacy")]);
  mockOsmSearch.mockResolvedValue([osmEl(1, "OSM Pharmacy")]);
});

describe("search cache stretching", () => {
  it("uses a 60-minute search TTL", () => {
    expect(SEARCH_CACHE_TTL_SEC).toBe(60 * 60);
  });

  it("shares one cached call across query variants via canonicalKey", async () => {
    process.env.SERPAPI_KEY = "test-key";
    const first = await searchPlaces({ query: "davakhana", lat: LAT, lng: LNG, radiusKm: 3 });
    expect(first.cached).toBe(false);
    expect(first.canonicalKey).toBe("pharmacy");
    expect(mockSerpSearch).toHaveBeenCalledTimes(1);

    const second = await searchPlaces({ query: "pharmacy", lat: LAT, lng: LNG, radiusKm: 3 });
    expect(second.cached).toBe(true);
    expect(mockSerpSearch).toHaveBeenCalledTimes(1);
  });
});

describe("OSM fallback tier", () => {
  it("uses OSM when there is no SERPAPI_KEY (no SerpApi call)", async () => {
    const res = await searchPlaces({ query: "pharmacy", lat: LAT, lng: LNG, radiusKm: 3 });
    expect(mockSerpSearch).not.toHaveBeenCalled();
    expect(mockOsmSearch).toHaveBeenCalledTimes(1);
    expect(res.fallback).toBe("osm");
    expect(res.places.length).toBeGreaterThan(0);
    expect(res.places[0].source).toBe("osm");
    expect(res.places[0].rating).toBeUndefined();
  });

  it("falls back to OSM when SerpApi errors", async () => {
    process.env.SERPAPI_KEY = "test-key";
    mockSerpSearch.mockRejectedValue(new Error("boom"));
    const res = await searchPlaces({ query: "pharmacy", lat: LAT, lng: LNG, radiusKm: 3 });
    expect(res.fallback).toBe("osm");
    expect(res.places[0].source).toBe("osm");
  });

  it("merges OSM extras when SerpApi returns zero results", async () => {
    process.env.SERPAPI_KEY = "test-key";
    mockSerpSearch.mockResolvedValue([]);
    const res = await searchPlaces({ query: "pharmacy", lat: LAT, lng: LNG, radiusKm: 3 });
    expect(res.fallback).toBe("osm");
    expect(res.places.some((p) => p.name === "OSM Pharmacy")).toBe(true);
  });

  it("prefers SerpApi results when the call succeeds (no OSM call)", async () => {
    process.env.SERPAPI_KEY = "test-key";
    const res = await searchPlaces({ query: "pharmacy", lat: LAT, lng: LNG, radiusKm: 3 });
    expect(res.fallback).toBeUndefined();
    expect(mockOsmSearch).not.toHaveBeenCalled();
    expect(res.places[0].name).toBe("Serp Pharmacy");
    expect(res.places[0].source).toBeUndefined();
  });

  it("throws QUOTA_EXCEEDED when quota is exhausted and OSM is empty", async () => {
    process.env.SERPAPI_KEY = "test-key";
    process.env.MONTHLY_CALL_LIMIT = "1";
    await incrementCalls(1);
    mockOsmSearch.mockResolvedValue([]);
    await expect(
      searchPlaces({ query: "pharmacy", lat: LAT, lng: LNG, radiusKm: 3 })
    ).rejects.toMatchObject({ code: "QUOTA_EXCEEDED" });
  });

  it("serves OSM instead of spending the last quota near the limit", async () => {
    process.env.SERPAPI_KEY = "test-key";
    process.env.MONTHLY_CALL_LIMIT = "10";
    await incrementCalls(9); // 90% -> near-limit guard trips
    const res = await searchPlaces({ query: "pharmacy", lat: LAT, lng: LNG, radiusKm: 3 });
    expect(mockSerpSearch).not.toHaveBeenCalled();
    expect(res.fallback).toBe("osm");
  });

  it("scores OSM places without ratings (no NaN)", async () => {
    const res = await searchPlaces({ query: "pharmacy", lat: LAT, lng: LNG, radiusKm: 3 });
    for (const p of res.places) {
      expect(typeof p.score).toBe("number");
      expect(Number.isNaN(p.score)).toBe(false);
      expect(p.score).toBeGreaterThanOrEqual(0);
      expect(p.score).toBeLessThanOrEqual(100);
    }
  });
});
