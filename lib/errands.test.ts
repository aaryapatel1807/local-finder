import { describe, expect, it } from "vitest";
import {
  midpoint,
  orderStopsNearestNeighbor,
  orderStopsTimeAware,
  parseErrandInput,
  ERRAND_MAX_CATEGORIES,
} from "./errands";

describe("midpoint", () => {
  it("averages lat/lng", () => {
    expect(midpoint({ lat: 0, lng: 0 }, { lat: 2, lng: 4 })).toEqual({
      lat: 1,
      lng: 2,
    });
  });

  it("handles negatives", () => {
    const m = midpoint({ lat: 22.3, lng: 73.18 }, { lat: 22.4, lng: 73.2 });
    expect(m.lat).toBeCloseTo(22.35, 10);
    expect(m.lng).toBeCloseTo(73.19, 10);
  });

  it("returns the same point when both ends are equal", () => {
    const m = midpoint({ lat: 22.3, lng: 73.18 }, { lat: 22.3, lng: 73.18 });
    expect(m).toEqual({ lat: 22.3, lng: 73.18 });
  });
});

describe("orderStopsNearestNeighbor", () => {
  it("returns an empty array for no stops", () => {
    expect(orderStopsNearestNeighbor([], { lat: 0, lng: 0 })).toEqual([]);
  });

  it("keeps a single stop", () => {
    const stops = [{ id: "a", lat: 1, lng: 1 }];
    expect(orderStopsNearestNeighbor(stops, { lat: 0, lng: 0 })).toEqual(stops);
  });

  it("visits the nearest stop first, then chains greedily", () => {
    // Stops east of the start, at 0.56 / 1.67 / 3.34 km — shuffled input,
    // greedy must still walk them nearest-first.
    const stops = [
      { id: "c", lat: 0, lng: 0.03 },
      { id: "b", lat: 0, lng: 0.015 },
      { id: "a", lat: 0, lng: 0.005 },
    ];
    const ordered = orderStopsNearestNeighbor(stops, { lat: 0, lng: 0 });
    expect(ordered.map((s) => s.id)).toEqual(["a", "b", "c"]);
  });

  it("jumps to a nearer side street instead of backtracking", () => {
    // Start (0,0); a is slightly north, b slightly further north.
    const stops = [
      { id: "b", lat: 0.002, lng: 0 },
      { id: "a", lat: 0.001, lng: 0 },
    ];
    const ordered = orderStopsNearestNeighbor(stops, { lat: 0, lng: 0 });
    expect(ordered.map((s) => s.id)).toEqual(["a", "b"]);
  });

  it("produces a sensible line-up for a fixture laid out along a street", () => {
    // Stops east of the start at 0.5 km, 1 km, 2 km (lng degrees ~111 km each).
    const stops = [
      { id: "far", lat: 0, lng: 0.018 },
      { id: "near", lat: 0, lng: 0.0045 },
      { id: "mid", lat: 0, lng: 0.009 },
    ];
    const ordered = orderStopsNearestNeighbor(stops, { lat: 0, lng: 0 });
    expect(ordered.map((s) => s.id)).toEqual(["near", "mid", "far"]);
  });

  it("does not mutate the input array", () => {
    const stops = [
      { id: "b", lat: 0, lng: 2 },
      { id: "a", lat: 0, lng: 1 },
    ];
    orderStopsNearestNeighbor(stops, { lat: 0, lng: 0 });
    expect(stops.map((s) => s.id)).toEqual(["b", "a"]);
  });
});

describe("parseErrandInput", () => {
  it("splits on commas, semicolons and newlines", () => {
    expect(parseErrandInput("pharmacy, ATM; groceries\ncoffee")).toEqual([
      "pharmacy",
      "ATM",
      "groceries",
      "coffee",
    ]);
  });

  it("trims whitespace and drops empties", () => {
    expect(parseErrandInput("  pharmacy ,, ;\n ATM  ")).toEqual(["pharmacy", "ATM"]);
  });

  it("returns empty for empty or blank input", () => {
    expect(parseErrandInput("")).toEqual([]);
    expect(parseErrandInput(" , ;\n ")).toEqual([]);
  });

  it("dedupes case-insensitively, keeping the first spelling", () => {
    expect(parseErrandInput("Pharmacy, pharmacy, ATM, atm")).toEqual([
      "Pharmacy",
      "ATM",
    ]);
  });

  it("caps at 4 categories", () => {
    const got = parseErrandInput("a, b, c, d, e, f");
    expect(got).toEqual(["a", "b", "c", "d"]);
    expect(got).toHaveLength(ERRAND_MAX_CATEGORIES);
  });

  it("single category works", () => {
    expect(parseErrandInput("pharmacy")).toEqual(["pharmacy"]);
  });
});

describe("orderStopsTimeAware", () => {
  const NOW = new Date("2026-10-10T18:00:00+05:30"); // 6:00 PM IST
  const start = { lat: 22.3072, lng: 73.1812 };

  it("puts the earliest-closing stop first", () => {
    const stops = [
      { id: "a", lat: 22.308, lng: 73.182, name: "Late Shop", minutesToClose: 300 }, // closes 11 PM
      { id: "b", lat: 22.309, lng: 73.183, name: "Early Pharmacy", minutesToClose: 30 }, // closes 6:30 PM, urgent
    ];
    const { ordered, warnings } = orderStopsTimeAware(stops, start, NOW);
    expect(ordered[0].id).toBe("b");
    expect(ordered[1].id).toBe("a");
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]).toMatch(/Early Pharmacy closes at/);
  });

  it("warns when arrival is after closing", () => {
    const stops = [
      // ~5 km away ≈ 67 min walk; closes in 30 min → unreachable
      { id: "far", lat: 22.35, lng: 73.22, name: "Far Clinic", minutesToClose: 30 },
    ];
    const { warnings } = orderStopsTimeAware(stops, start, NOW);
    expect(warnings.some(w => /likely closed/.test(w))).toBe(true);
  });

  it("orders flexible stops (no hours) by distance after urgent ones", () => {
    const stops = [
      { id: "flex", lat: 22.3075, lng: 73.1815, name: "No Hours Shop" },
      { id: "urgent", lat: 22.31, lng: 73.185, name: "Urgent Meds", minutesToClose: 45 },
    ];
    const { ordered } = orderStopsTimeAware(stops, start, NOW);
    expect(ordered[0].id).toBe("urgent");
    expect(ordered[1].id).toBe("flex");
  });

  it("handles empty input", () => {
    const { ordered, warnings } = orderStopsTimeAware([], start, NOW);
    expect(ordered).toEqual([]);
    expect(warnings).toEqual([]);
  });
});
