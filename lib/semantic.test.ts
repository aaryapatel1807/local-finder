import { describe, expect, it } from "vitest";
import { semanticScore, tokenize } from "./semantic";

describe("semanticScore", () => {
  it("ranks a cafe above a hospital for 'somewhere quiet to study'", () => {
    const query = "somewhere quiet to study";
    const cafe = semanticScore(query, { name: "Blue Tokai", category: "cafe" });
    const hospital = semanticScore(query, { name: "City Hospital", category: "hospital" });
    expect(cafe).toBeGreaterThan(0);
    expect(hospital).toBe(0);
    expect(cafe).toBeGreaterThan(hospital);
  });

  it("matches a budget restaurant for 'cheap food'", () => {
    const restaurant = semanticScore("cheap food", {
      name: "Annapurna Tiffin",
      category: "budget restaurant",
    });
    const pharmacy = semanticScore("cheap food", {
      name: "Apollo Pharmacy",
      category: "pharmacy",
    });
    expect(restaurant).toBeGreaterThan(0);
    expect(restaurant).toBeGreaterThan(pharmacy);
  });

  it("returns 0 for an empty query", () => {
    expect(semanticScore("", { name: "Blue Tokai" })).toBe(0);
    expect(semanticScore("   ", { name: "Blue Tokai" })).toBe(0);
    expect(semanticScore("the and or", { name: "Blue Tokai" })).toBe(0); // stopwords only
  });

  it("scores an exact name match highest", () => {
    const exact = semanticScore("blue tokai", { name: "Blue Tokai", category: "cafe" });
    const partial = semanticScore("blue tokai", { name: "Coffee House", category: "cafe" });
    expect(exact).toBeGreaterThan(partial);
    const top = Math.max(
      exact,
      semanticScore("blue tokai", { name: "Cafe Coffee Day", category: "cafe" }),
      semanticScore("blue tokai", { name: "Starbucks", category: "coffee shop" })
    );
    expect(top).toBe(exact);
  });
});

describe("tokenize", () => {
  it("lowercases, splits, and drops stopwords", () => {
    expect(tokenize("Somewhere Quiet To Study")).toEqual(["somewhere", "quiet", "study"]);
  });

  it("drops Hinglish stopwords", () => {
    expect(tokenize("achha chai wala")).toEqual(["chai"]);
  });
});
