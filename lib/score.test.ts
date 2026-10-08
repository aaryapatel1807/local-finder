import { describe, expect, it } from "vitest";
import {
  bayesianAverage,
  meanRatingOf,
  scorePlace,
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
