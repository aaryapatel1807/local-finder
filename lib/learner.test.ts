import { describe, expect, it } from "vitest";
import {
  DEFAULT_WEIGHTS,
  MIN_WEIGHT,
  featuresOf,
  scoreWithWeights,
  updateWeights,
  type FeatureVec,
  type RankWeights,
} from "./learner";

describe("updateWeights", () => {
  it("moves weights toward the chosen place's strengths", () => {
    // User picks a close but low-rated place over a far high-rated top pick.
    const chosen: FeatureVec = { rating01: 0.5, proximity01: 0.95, open01: 1, sentiment01: 0.5 };
    const shownTop: FeatureVec = { rating01: 0.98, proximity01: 0.3, open01: 1, sentiment01: 0.5 };
    const before: RankWeights = { ...DEFAULT_WEIGHTS };
    const after = updateWeights(before, chosen, shownTop, 0.05);

    expect(after.proximity).toBeGreaterThan(before.proximity); // close place wins
    expect(after.rating).toBeLessThan(before.rating); // rating loses
    // equal features → no direct change, only redistribution from renorm
    expect(Math.abs(after.open - before.open)).toBeLessThan(0.01);
    // sentiment starts at 0 (DEFAULT); the clamp floor only lifts it up
    expect(after.sentiment).toBeGreaterThan(before.sentiment);
  });

  it("weights always sum to 1 and stay >= 0.02", () => {
    const chosen: FeatureVec = { rating01: 0, proximity01: 0, open01: 0, sentiment01: 0 };
    const shownTop: FeatureVec = { rating01: 1, proximity01: 1, open01: 1, sentiment01: 1 };
    let w: RankWeights = { ...DEFAULT_WEIGHTS };
    for (let i = 0; i < 50; i++) {
      w = updateWeights(w, chosen, shownTop, 0.5);
      const sum = w.rating + w.proximity + w.open + w.sentiment;
      expect(sum).toBeCloseTo(1, 8);
      expect(w.rating).toBeGreaterThanOrEqual(MIN_WEIGHT);
      expect(w.proximity).toBeGreaterThanOrEqual(MIN_WEIGHT);
      expect(w.open).toBeGreaterThanOrEqual(MIN_WEIGHT);
      expect(w.sentiment).toBeGreaterThanOrEqual(MIN_WEIGHT);
    }
  });

  it("lr=0 is the identity", () => {
    const chosen: FeatureVec = { rating01: 0.2, proximity01: 0.9, open01: 1, sentiment01: 0.7 };
    const shownTop: FeatureVec = { rating01: 0.9, proximity01: 0.1, open01: 0, sentiment01: 0.2 };
    const w: RankWeights = { rating: 0.4, proximity: 0.3, open: 0.2, sentiment: 0.1 };
    const after = updateWeights(w, chosen, shownTop, 0);
    expect(after).toEqual(w);
  });

  it("cold start: DEFAULT_WEIGHTS ranking matches server 'best' order", () => {
    // Fixture: matches score.ts best-match inputs. proximity weights identical
    // to the server, so ordering should agree when features align.
    const radiusKm = 5;
    const places = [
      { rating: 4.8, distanceKm: 0.6, isOpen: true as boolean | null }, // best overall
      { rating: 4.6, distanceKm: 3.4, isOpen: true as boolean | null },
      { rating: 3.2, distanceKm: 0.2, isOpen: true as boolean | null },
    ];
    const serverOrder = [...places]
      .map((p) => ({
        p,
        s: 0.45 * ((p.rating ?? 3) / 5) + 0.35 * Math.max(0, 1 - p.distanceKm / radiusKm) + 0.2 * 1,
      }))
      .sort((a, b) => b.s - a.s)
      .map((x) => x.p);
    const personalOrder = [...places]
      .map((p) => ({ p, s: scoreWithWeights(featuresOf(p, radiusKm), DEFAULT_WEIGHTS) }))
      .sort((a, b) => b.s - a.s)
      .map((x) => x.p);
    expect(personalOrder.map((p) => p.rating)).toEqual(serverOrder.map((p) => p.rating));
  });
});

describe("featuresOf", () => {
  it("normalizes defaults for unknown fields", () => {
    const f = featuresOf({}, 5);
    expect(f).toEqual({ rating01: 0.6, proximity01: 0, open01: 0, sentiment01: 0.5 });
  });

  it("encodes open state as 1 / 0.5 / 0", () => {
    expect(featuresOf({ isOpen: true }, 5).open01).toBe(1);
    expect(featuresOf({ isOpen: null }, 5).open01).toBe(0.5);
    expect(featuresOf({ isOpen: false }, 5).open01).toBe(0);
  });

  it("encodes sentiment from [-1, 1] to [0, 1]", () => {
    expect(featuresOf({ sentiment: 1 }, 5).sentiment01).toBe(1);
    expect(featuresOf({ sentiment: -1 }, 5).sentiment01).toBe(0);
    expect(featuresOf({ sentiment: 0 }, 5).sentiment01).toBe(0.5);
  });
});
