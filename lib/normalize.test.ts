import { describe, expect, it } from "vitest";
import { normalizePlace, parseWeeklyHours } from "./normalize";

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
