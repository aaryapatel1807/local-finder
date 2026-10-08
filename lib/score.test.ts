import { describe, expect, it } from "vitest";
import {
  bayesianAverage,
  meanRatingOf,
  scorePlace,
  blendSentiment,
  hiddenGemIdSet,
  BAYES_CONFIDENCE,
  FALLBACK_MEAN_RATING,
} from "./score";

describe("bayesianAverage", () => {
  it("regresses low-volume ratings toward the mean", () => {
    // R=5, v=3, m=50, C=4 -> (3/53)*5 + (50/53)*4 = 4.0566.
    expect(bayesianAverage(5, 3, 4)).toBeCloseTo(4.0566, 3);
  });

  it("approaches the raw rating at high volume", () => {
    // v=2000 barely moves toward C.
    const b = bayesianAverage(4.6, 2000, 4.0);
    expect(b).toBeGreaterThan(4.55);
    expect(b).toBeLessThan(4.6);
  });

  it("uses m=50 as the confidence threshold", () => {
    expect(BAYES_CONFIDENCE).toBe(50);
  });

  it("falls back to the mean when rating/volume are missing", () => {
    expect(bayesianAverage(undefined, undefined, 4.2)).toBe(4.2);
  });
});

describe("meanRatingOf", () => {
  it("averages the rated places", () => {
    expect(meanRatingOf([{ rating: 4 }, { rating: 5 }])).toBe(4.5);
  });

  it("ignores unrated places", () => {
    expect(meanRatingOf([{ rating: 4 }, {}, { rating: undefined }])).toBe(4);
  });

  it("falls back to 4.2 when nothing is rated", () => {
    expect(meanRatingOf([{}, {}])).toBe(FALLBACK_MEAN_RATING);
  });
});

describe("scorePlace", () => {
  // bayes for R=4.5, v=100, C=4.3: (100/150)*4.5 + (50/150)*4.3 = 4.4333.
  // score = 100*(0.45*(4.4333/5) + 0.35*proximity + 0.20*openBonus).

  const base = { rating: 4.5, reviews: 100, distanceKm: 0 };

  it("scores a perfect nearby open place near the top", () => {
    const s = scorePlace({ ...base, isOpen: true }, 3, 4.3);
    // 100*(0.45*0.8867 + 0.35*1 + 0.20*1) = 94.9
    expect(s).toBeCloseTo(94.9, 1);
    expect(s).toBeLessThanOrEqual(100);
  });

  it("penalizes closed places via openBonus=0", () => {
    const open = scorePlace({ ...base, isOpen: true }, 3, 4.3);
    const closed = scorePlace({ ...base, isOpen: false }, 3, 4.3);
    expect(open - closed).toBeCloseTo(20, 5); // 0.20 weight * 100
  });

  it("gives unknown open status half the open bonus", () => {
    const open = scorePlace({ ...base, isOpen: true }, 3, 4.3);
    const unknown = scorePlace({ ...base, isOpen: null }, 3, 4.3);
    expect(open - unknown).toBeCloseTo(10, 5); // 0.20 * 0.5 * 100
  });

  it("drives proximity to 0 at the radius edge", () => {
    const near = scorePlace({ ...base, distanceKm: 0, isOpen: true }, 3, 4.3);
    const far = scorePlace({ ...base, distanceKm: 3, isOpen: true }, 3, 4.3);
    expect(near - far).toBeCloseTo(35, 5); // 0.35 weight * 100
  });

  it("clamps proximity at 0 beyond the radius", () => {
    const edge = scorePlace({ ...base, distanceKm: 3, isOpen: true }, 3, 4.3);
    const beyond = scorePlace({ ...base, distanceKm: 99, isOpen: true }, 3, 4.3);
    expect(beyond).toBe(edge);
  });

  it("prefers high-volume ratings over lonely 5-stars", () => {
    const lonely = scorePlace(
      { rating: 5, reviews: 3, distanceKm: 0, isOpen: true },
      3,
      4.3
    );
    const solid = scorePlace(
      { rating: 4.6, reviews: 2000, distanceKm: 0, isOpen: true },
      3,
      4.3
    );
    expect(solid).toBeGreaterThan(lonely);
  });

  it("never returns NaN when fields are missing", () => {
    const s = scorePlace({}, 3);
    expect(Number.isFinite(s)).toBe(true);
  });
});

describe("scorePlace with sentiment", () => {
  // bayes for R=4.5, v=100, C=4.3: (100/150)*4.5 + (50/150)*4.3 = 4.4333.
  const base = { rating: 4.5, reviews: 100, distanceKm: 0, isOpen: true as const };

  it("is identical to the original formula when sentiment is undefined", () => {
    const plain = scorePlace(base, 3, 4.3);
    const withUndef = scorePlace(base, 3, 4.3, undefined);
    expect(withUndef).toBe(plain);
    expect(withUndef).toBeCloseTo(94.9, 1);
  });

  it("uses the rebalanced weights when sentiment is defined", () => {
    // sentiment=+1 -> sentiment01=1:
    // 100*(0.40*(4.4333/5) + 0.30*1 + 0.15*1 + 0.15*1) = 95.4667 -> 95.5
    const s = scorePlace(base, 3, 4.3, 1);
    expect(s).toBeCloseTo(95.5, 1);
  });

  it("rewards positive sentiment over negative", () => {
    const good = scorePlace(base, 3, 4.3, 0.8);
    const bad = scorePlace(base, 3, 4.3, -0.8);
    expect(good).toBeGreaterThan(bad);
    // sentiment weight 0.15 * delta 0.8 (0.9 vs 0.1) * 100 = 12
    expect(good - bad).toBeCloseTo(12, 1);
  });

  it("clamps out-of-range sentiment to -1..1", () => {
    expect(scorePlace(base, 3, 4.3, 99)).toBe(scorePlace(base, 3, 4.3, 1));
    expect(scorePlace(base, 3, 4.3, -99)).toBe(scorePlace(base, 3, 4.3, -1));
  });

  it("treats NaN sentiment like undefined", () => {
    expect(scorePlace(base, 3, 4.3, NaN)).toBe(scorePlace(base, 3, 4.3));
  });
});

describe("blendSentiment", () => {
  it("is a no-op when sentiment is undefined", () => {
    expect(blendSentiment(72.4)).toBe(72.4);
    expect(blendSentiment(72.4, undefined)).toBe(72.4);
  });

  it("nudges the score by up to ±5 points", () => {
    expect(blendSentiment(80, 1)).toBe(85);
    expect(blendSentiment(80, -1)).toBe(75);
    expect(blendSentiment(80, 0)).toBe(80);
    expect(blendSentiment(80, 0.5)).toBe(82.5);
  });

  it("clamps to 0..100", () => {
    expect(blendSentiment(99, 1)).toBe(100);
    expect(blendSentiment(1, -1)).toBe(0);
  });
});

describe("hiddenGemIdSet", () => {
  const mk = (id: string, rating: number, reviews: number) => ({ id, rating, reviews });

  it("returns an empty set for fewer than 4 places", () => {
    expect(hiddenGemIdSet([mk("a", 5, 10), mk("b", 4.9, 20)])).toEqual(new Set());
  });

  it("flags top-quartile Bayesian places with <100 reviews", () => {
    const places = [
      mk("gem1", 4.9, 45),
      mk("gem2", 4.8, 30),
      mk("mid1", 4.2, 500),
      mk("mid2", 4.1, 800),
      mk("mid3", 4.0, 300),
      mk("low1", 3.5, 150),
      mk("low2", 3.2, 90),
      mk("low3", 3.0, 40),
    ];
    const gems = hiddenGemIdSet(places);
    expect(gems.has("gem1")).toBe(true);
    expect(gems.has("gem2")).toBe(true);
    expect(gems.has("low3")).toBe(false);
  });

  it("excludes top-quartile places with >= 100 reviews", () => {
    const places = [
      mk("popular", 4.9, 5000),
      mk("mid1", 4.2, 500),
      mk("mid2", 4.1, 800),
      mk("mid3", 4.0, 300),
    ];
    expect(hiddenGemIdSet(places).has("popular")).toBe(false);
  });

  it("handles places with missing ratings without NaN", () => {
    const places = [
      { id: "a", reviews: 10 },
      { id: "b", reviews: 20 },
      { id: "c", rating: 4.5, reviews: 30 },
      { id: "d", rating: 4.0, reviews: 400 },
    ];
    const gems = hiddenGemIdSet(places);
    for (const id of Array.from(gems)) expect(typeof id).toBe("string");
  });
});
