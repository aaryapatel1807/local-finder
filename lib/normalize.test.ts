import { describe, expect, it } from "vitest";
import {
  normalizePlace,
  parseWeeklyHours,
  dedupePlaces,
  nameSimilarity,
} from "./normalize";

const ORIGIN = { lat: 22.3072, lng: 73.1812 };
const NOW = new Date(2026, 9, 8, 20, 0, 0); // Thu Oct 8 2026, 8 pm local

describe("normalizePlace", () => {
  it("excludes permanently-closed places (returns null)", () => {
    const p = normalizePlace(
      {
        title: "Old City Medical",
        place_id: "ChIJx",
        open_state: "Permanently closed",
        rating: 3.2,
        reviews: 45,
      },
      ORIGIN,
      NOW
    );
    expect(p).toBeNull();
  });

  it("normalizes a full SerpApi item to the Place shape", () => {
    const p = normalizePlace(
      {
        title: "Sunrise Medical",
        place_id: "ChIJsunrise",
        data_id: "0xabc:0xdef",
        rating: 4.4,
        reviews: 312,
        price: "₹",
        type: "Pharmacy",
        types: ["Pharmacy", "Medical store"],
        address: "12, Station Road, Vadodara",
        phone: "+91 265 236 4455",
        website: "https://sunrisemedical.example.in",
        open_state: "Open ⋅ Closes 11 pm",
        hours: ["Thursday: 9:00 AM – 11:00 PM"],
        gps_coordinates: { latitude: 22.312, longitude: 73.1818 },
        thumbnail: "https://picsum.photos/seed/x/400/300",
      },
      ORIGIN,
      NOW
    );

    expect(p).not.toBeNull();
    expect(p!.id).toBe("ChIJsunrise");
    expect(p!.dataId).toBe("0xabc:0xdef");
    expect(p!.name).toBe("Sunrise Medical");
    expect(p!.category).toBe("Pharmacy");
    expect(p!.rating).toBe(4.4);
    expect(p!.reviews).toBe(312);
    expect(p!.price).toBe("₹");
    expect(p!.isOpen).toBe(true);
    expect(p!.closesSoon).toBe(false); // 11 pm is 3h away from 8 pm
    expect(p!.lat).toBe(22.312);
    expect(p!.lng).toBe(73.1818);
    expect(p!.distanceKm).toBeGreaterThan(0);
    expect(p!.distanceKm).toBeLessThan(1);
    expect(p!.thumbnail).toContain("picsum.photos");
  });

  it("degrades gracefully when fields are missing", () => {
    const p = normalizePlace({}, ORIGIN, NOW);
    expect(p).not.toBeNull();
    expect(p!.name).toBe("Unknown place");
    expect(p!.id).toMatch(/^mock:/);
    expect(p!.isOpen).toBeNull(); // hours unknown
    expect(p!.closesSoon).toBe(false);
    expect(p!.rating).toBeUndefined();
    expect(p!.distanceKm).toBeUndefined();
    expect(p!.weeklyHours).toBeUndefined();
  });

  it("keeps temporarily-closed places as closed (not excluded)", () => {
    const p = normalizePlace(
      { title: "X", open_state: "Temporarily closed" },
      ORIGIN,
      NOW
    );
    expect(p).not.toBeNull();
    expect(p!.isOpen).toBe(false);
  });

  it("passes price and thumbnail through untouched", () => {
    const p = normalizePlace(
      { title: "X", price: "$$$", thumbnail: "https://t.example/i.jpg" },
      ORIGIN,
      NOW
    );
    expect(p!.price).toBe("$$$");
    expect(p!.thumbnail).toBe("https://t.example/i.jpg");
  });

  it("converts string ratings/reviews defensively", () => {
    const p = normalizePlace(
      { title: "X", rating: "4.4" as unknown as number, reviews: "312" as unknown as number },
      ORIGIN,
      NOW
    );
    expect(p!.rating).toBe(4.4);
    expect(p!.reviews).toBe(312);
  });
});

describe("parseWeeklyHours", () => {
  it("parses the operating_hours object form", () => {
    const h = parseWeeklyHours({
      operating_hours: { monday: "9AM–5PM", tuesday: "Closed" },
    });
    expect(h).toEqual({ Monday: "9AM–5PM", Tuesday: "Closed" });
  });

  it("parses the hours string-array form", () => {
    const h = parseWeeklyHours({
      hours: ["Monday: 9:00 AM – 11:00 PM", "Tuesday: 9:00 AM – 11:00 PM"],
    });
    expect(h).toEqual({
      Monday: "9:00 AM – 11:00 PM",
      Tuesday: "9:00 AM – 11:00 PM",
    });
  });

  it("returns undefined when nothing parseable exists", () => {
    expect(parseWeeklyHours({})).toBeUndefined();
    expect(parseWeeklyHours({ hours: "Closed ⋅ Opens 9 am" })).toBeUndefined();
    expect(parseWeeklyHours({ hours: [] })).toBeUndefined();
  });

  it("ignores non-day keys defensively", () => {
    const h = parseWeeklyHours({
      operating_hours: { monday: "9AM–5PM", foo: "bar" } as Record<string, string>,
    });
    expect(h).toEqual({ Monday: "9AM–5PM" });
  });
});

describe("dedupePlaces", () => {
  const mk = (
    overrides: Partial<import("./schemas").Place>
  ): import("./schemas").Place => ({
    id: "x",
    name: "Apollo Pharmacy",
    lat: 22.31,
    lng: 73.175,
    isOpen: true,
    closesSoon: false,
    ...overrides,
  });

  it("drops a near-identical name within 0.15 km", () => {
    const a = mk({ id: "a", reviews: 100, rating: 4.2 });
    const b = mk({
      id: "b",
      name: "Apollo Pharmacy ",
      lat: 22.3101, // ~11 m away
      lng: 73.1751,
      reviews: 250,
      rating: 4.0,
    });
    const out = dedupePlaces([a, b]);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("b"); // more reviews wins
  });

  it("keeps the higher-rated listing when reviews tie", () => {
    const a = mk({ id: "a", reviews: 100, rating: 4.2 });
    const b = mk({
      id: "b",
      name: "APOLLO PHARMACY",
      lat: 22.3101,
      lng: 73.1751,
      reviews: 100,
      rating: 4.8,
    });
    const out = dedupePlaces([a, b]);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("b");
  });

  it("keeps both when the names differ", () => {
    const a = mk({ id: "a" });
    const b = mk({ id: "b", name: "MedPlus Pharmacy" });
    expect(dedupePlaces([a, b])).toHaveLength(2);
  });

  it("keeps both when the distance is >= 0.15 km", () => {
    const a = mk({ id: "a" });
    const b = mk({ id: "b", lat: 22.32, lng: 73.175 }); // ~1.1 km away
    expect(dedupePlaces([a, b])).toHaveLength(2);
  });

  it("is not fooled by subset names (Jaccard < 0.8)", () => {
    const a = mk({ id: "a", name: "Apollo Pharmacy Store" });
    const b = mk({ id: "b", name: "Apollo Pharmacy" });
    // Jaccard = 2/3 < 0.8 -> not dupes.
    expect(nameSimilarity("Apollo Pharmacy Store", "Apollo Pharmacy")).toBeCloseTo(
      2 / 3,
      5
    );
    expect(dedupePlaces([a, b])).toHaveLength(2);
  });

  it("handles an empty list", () => {
    expect(dedupePlaces([])).toEqual([]);
  });
});

describe("nameSimilarity", () => {
  it("is case- and punctuation-insensitive", () => {
    expect(nameSimilarity("Sunrise Medical!", "sunrise medical")).toBe(1);
  });

  it("returns 0 for disjoint names", () => {
    expect(nameSimilarity("Apollo Pharmacy", "SBI ATM")).toBe(0);
  });
});
