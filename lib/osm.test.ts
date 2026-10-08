import { describe, expect, it } from "vitest";
import {
  buildOverpassQuery,
  normalizeOsmElement,
  parseOsmOpeningHours,
  type OsmElement,
} from "./osm";

const ORIGIN = { lat: 22.3072, lng: 73.1812 };

function node(
  overrides: Partial<OsmElement> = {},
  tags: Record<string, string> = {}
): OsmElement {
  return {
    type: "node",
    id: 1,
    lat: 22.31,
    lon: 73.18,
    tags: { name: "Test Pharmacy", ...tags },
    ...overrides,
  };
}

describe("buildOverpassQuery", () => {
  it("maps a known category to tag selectors", () => {
    const q = buildOverpassQuery("pharmacy", 22.3, 73.18, 3);
    expect(q).toContain('["amenity"="pharmacy"]');
    expect(q).toContain("around:3000,22.3,73.18");
    expect(q).toContain("out center");
  });

  it("maps multi-value categories with regex", () => {
    const q = buildOverpassQuery("clinic", 22.3, 73.18, 1);
    expect(q).toContain("clinic|doctors");
  });

  it("falls back to a bounded name regex for free text", () => {
    const q = buildOverpassQuery("biryani house", 22.3, 73.18, 5);
    expect(q).toContain('["name"~"biryani house",i]');
  });

  it("escapes regex metacharacters in the free-text fallback", () => {
    const q = buildOverpassQuery("a+b (c)", 22.3, 73.18, 1);
    expect(q).toContain("a\\+b \\(c\\)");
    expect(q).not.toContain("a+b (c)");
  });
});

describe("parseOsmOpeningHours", () => {
  // Monday 2026-10-05 10:30 local
  const mondayMorning = new Date(2026, 9, 5, 10, 30);
  // Sunday 2026-10-11 10:30 local
  const sundayMorning = new Date(2026, 9, 11, 10, 30);
  // Monday 2026-10-05 01:00 local (overnight span from Sunday's rule)
  const mondayEarly = new Date(2026, 9, 5, 1, 0);

  it("handles 24/7", () => {
    expect(parseOsmOpeningHours("24/7", mondayMorning)).toEqual({
      isOpen: true,
      label: "Open 24 hours",
    });
  });

  it("detects open within a weekday range", () => {
    const s = parseOsmOpeningHours("Mo-Fr 09:00-18:00", mondayMorning);
    expect(s.isOpen).toBe(true);
    expect(s.hoursToday).toContain("18:00");
  });

  it("detects closed on a non-listed day", () => {
    const s = parseOsmOpeningHours("Mo-Fr 09:00-18:00", sundayMorning);
    expect(s.isOpen).toBe(false);
  });

  it("handles comma day lists and multiple spans", () => {
    const s = parseOsmOpeningHours(
      "Mo,We,Fr 09:00-13:00, 14:00-18:00",
      mondayMorning
    );
    expect(s.isOpen).toBe(true);
  });

  it("handles overnight spans via the previous day's rule", () => {
    // "Su 18:00-02:00" means Sunday 18:00 -> Monday 02:00.
    const s = parseOsmOpeningHours("Su 18:00-02:00", mondayEarly);
    expect(s.isOpen).toBe(true);
  });

  it("returns null for unparseable input", () => {
    expect(parseOsmOpeningHours("nonsense", mondayMorning)).toEqual({
      isOpen: null,
    });
    expect(parseOsmOpeningHours("", mondayMorning)).toEqual({ isOpen: null });
  });
});

describe("normalizeOsmElement", () => {
  it("normalizes a node with tags", () => {
    const p = normalizeOsmElement(
      node(
        {},
        {
          amenity: "pharmacy",
          "addr:street": "MG Road",
          "addr:city": "Vadodara",
          phone: "+911234567890",
          opening_hours: "24/7",
        }
      ),
      ORIGIN
    );
    expect(p).not.toBeNull();
    expect(p!.id).toBe("osm:node/1");
    expect(p!.name).toBe("Test Pharmacy");
    expect(p!.source).toBe("osm");
    expect(p!.address).toBe("MG Road, Vadodara");
    expect(p!.phone).toBe("+911234567890");
    expect(p!.isOpen).toBe(true);
    expect(p!.rating).toBeUndefined();
    expect(p!.reviews).toBeUndefined();
    expect(typeof p!.distanceKm).toBe("number");
    expect(p!.closesSoon).toBe(false);
  });

  it("uses the way center for ways", () => {
    const p = normalizeOsmElement(
      {
        type: "way",
        id: 99,
        center: { lat: 22.32, lon: 73.19 },
        tags: { name: "Way Cafe", amenity: "cafe" },
      },
      ORIGIN
    );
    expect(p).not.toBeNull();
    expect(p!.id).toBe("osm:way/99");
    expect(p!.lat).toBe(22.32);
  });

  it("skips unnamed elements and elements without coordinates", () => {
    const unnamed = node();
    delete unnamed.tags!.name;
    expect(normalizeOsmElement(unnamed, ORIGIN)).toBeNull();
    expect(
      normalizeOsmElement(
        { type: "node", id: 2, tags: { name: "No coords" } },
        ORIGIN
      )
    ).toBeNull();
  });

  it("leaves hours unknown when no opening_hours tag", () => {
    const p = normalizeOsmElement(node(), ORIGIN);
    expect(p!.isOpen).toBeNull();
    expect(p!.openLabel).toBeUndefined();
  });
});
