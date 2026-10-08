import { describe, expect, it } from "vitest";
import { haversineKm } from "./distance";

describe("haversineKm", () => {
  it("returns 0 for identical points", () => {
    expect(haversineKm(22.3072, 73.1812, 22.3072, 73.1812)).toBe(0);
  });

  it("returns ~111.195 km for one degree of longitude at the equator", () => {
    expect(haversineKm(0, 0, 0, 1)).toBeCloseTo(111.195, 2);
  });

  it("returns ~111.195 km for one degree of latitude", () => {
    expect(haversineKm(0, 0, 1, 0)).toBeCloseTo(111.195, 2);
  });

  it("returns ~half the earth circumference for antipodal points", () => {
    expect(haversineKm(0, 0, 0, 180)).toBeCloseTo(20015.1, 0);
  });

  it("computes Vadodara -> Ahmedabad at roughly 101 km", () => {
    // Vadodara (22.3072, 73.1812) -> Ahmedabad (23.0225, 72.5714).
    const d = haversineKm(22.3072, 73.1812, 23.0225, 72.5714);
    expect(d).toBeGreaterThan(95);
    expect(d).toBeLessThan(108);
  });

  it("is symmetric", () => {
    const a = haversineKm(22.3, 73.18, 22.31, 73.17);
    const b = haversineKm(22.31, 73.17, 22.3, 73.18);
    expect(a).toBeCloseTo(b, 10);
  });
});
