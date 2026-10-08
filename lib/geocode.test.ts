import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { geocodePlace, geocodeCacheKey } from "./geocode";
import { clearMemoryCache } from "./cache";

const PHOTON_HIT = {
  features: [
    {
      geometry: { coordinates: [73.1812, 22.3072] }, // [lng, lat]
      properties: {
        name: "Vadodara",
        city: "Vadodara",
        state: "Gujarat",
        country: "India",
      },
    },
  ],
};

function mockPhoton(json: unknown, ok = true) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok, json: async () => json })
  );
}

beforeEach(() => {
  clearMemoryCache();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("geocodePlace", () => {
  it("returns { lat, lng, label } from the top Photon feature", async () => {
    mockPhoton(PHOTON_HIT);
    const out = await geocodePlace("Vadodara");
    expect(out).toEqual({
      lat: 22.3072,
      lng: 73.1812,
      label: "Vadodara, Vadodara, India",
    });
    expect(fetch).toHaveBeenCalledOnce();
    const url = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain("photon.komoot.io/api/?q=Vadodara&limit=1");
  });

  it("builds the label from name/state/country when city is missing", async () => {
    mockPhoton({
      features: [
        {
          geometry: { coordinates: [72.8, 18.9] },
          properties: { name: "Somewhere", state: "Gujarat", country: "India" },
        },
      ],
    });
    const out = await geocodePlace("Somewhere");
    expect(out?.label).toBe("Somewhere, Gujarat, India");
  });

  it("returns null when Photon has no features", async () => {
    mockPhoton({ features: [] });
    expect(await geocodePlace("asdfghjkl nowhere")).toBeNull();
  });

  it("returns null when features are missing entirely", async () => {
    mockPhoton({});
    expect(await geocodePlace("nowhere")).toBeNull();
  });

  it("returns null for an empty query without calling fetch", async () => {
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);
    expect(await geocodePlace("   ")).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it("returns null on non-OK HTTP status", async () => {
    mockPhoton({ error: "bad" }, false);
    expect(await geocodePlace("Vadodara")).toBeNull();
  });

  it("returns null (never throws) on network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("boom")));
    expect(await geocodePlace("Vadodara")).toBeNull();
  });

  it("serves the second identical call from the 7-day cache", async () => {
    mockPhoton(PHOTON_HIT);
    const first = await geocodePlace("Vadodara");
    const second = await geocodePlace("vadodara"); // case-insensitive key
    expect(second).toEqual(first);
    expect(fetch).toHaveBeenCalledOnce(); // cache hit, no second fetch
  });

  it("normalizes the cache key", () => {
    expect(geocodeCacheKey("  Vadodara  Station ")).toBe(
      "geocode:vadodara station"
    );
  });
});
