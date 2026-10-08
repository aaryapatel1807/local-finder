/**
 * On-device online rank learner (Phase 2 ML workstream).
 *
 * Pure, dependency-free TypeScript — no imports, no server calls. Learns
 * the user's personal ranking preferences from their interactions and
 * re-ranks results entirely in the browser (localStorage holds the weights).
 *
 * Model: a perceptron-style online update on four normalized features
 * (rating, proximity, open-now, sentiment). Each feature lives in [0, 1] and
 * the weights always sum to 1 with a floor of 0.02, so no feature can ever
 * be completely ignored.
 */

/** Ranking feature weights. Mirrors the server 'best-match' proportions. */
export type RankWeights = {
  rating: number;
  proximity: number;
  open: number;
  sentiment: number;
};

/** Cold-start weights — same blend as the server's best-match score. */
export const DEFAULT_WEIGHTS: RankWeights = {
  rating: 0.45,
  proximity: 0.35,
  open: 0.2,
  sentiment: 0,
};

/** Normalized feature vector — every component in [0, 1]. */
export type FeatureVec = {
  rating01: number;
  proximity01: number;
  open01: number;
  sentiment01: number;
};

/** Minimum weight any feature can take after an update. */
export const MIN_WEIGHT = 0.02;

const WEIGHT_KEYS: (keyof RankWeights)[] = [
  "rating",
  "proximity",
  "open",
  "sentiment",
];

/** Feature keys in the same order as WEIGHT_KEYS (rating↔rating01, …). */
const FEATURE_KEYS: (keyof FeatureVec)[] = [
  "rating01",
  "proximity01",
  "open01",
  "sentiment01",
];

export type FeatureSource = {
  rating?: number;
  distanceKm?: number;
  isOpen?: boolean | null;
  sentiment?: number;
};

/**
 * Extract a normalized feature vector from a place.
 *
 * - rating01: (rating ?? 3) / 5 — unrated places land at 0.6, neutral-ish
 * - proximity01: max(0, 1 - distanceKm / radiusKm) — unknown distance is the worst
 * - open01: open → 1, unknown → 0.5, closed → 0
 * - sentiment01: unknown → 0.5, otherwise (sentiment + 1) / 2 for sentiment in [-1, 1]
 */
export function featuresOf(source: FeatureSource, radiusKm: number): FeatureVec {
  const rating01 = clamp01((source.rating ?? 3) / 5);
  const distance = source.distanceKm ?? radiusKm;
  const proximity01 =
    radiusKm > 0 ? clamp01(Math.max(0, 1 - distance / radiusKm)) : 0;
  const open01 =
    source.isOpen === true ? 1 : source.isOpen === null ? 0.5 : 0;
  const sentiment01 =
    source.sentiment === undefined ? 0.5 : clamp01((source.sentiment + 1) / 2);
  return { rating01, proximity01, open01, sentiment01 };
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

/**
 * Perceptron-style online update: nudge the weights toward the place the
 * user actually chose relative to the place shown at rank 0.
 *
 * w[k] += lr * (chosen[k] - shownTop[k]), then clamp each component to
 * ≥ MIN_WEIGHT and renormalize so the weights always sum to 1.
 */
export function updateWeights(
  w: RankWeights,
  chosen: FeatureVec,
  shownTop: FeatureVec,
  lr = 0.05
): RankWeights {
  const next: RankWeights = { rating: w.rating, proximity: w.proximity, open: w.open, sentiment: w.sentiment };
  let changed = false;
  for (let i = 0; i < WEIGHT_KEYS.length; i++) {
    const wk = WEIGHT_KEYS[i];
    const fk = FEATURE_KEYS[i];
    const updated = Math.max(MIN_WEIGHT, next[wk] + lr * (chosen[fk] - shownTop[fk]));
    if (updated !== next[wk]) changed = true;
    next[wk] = updated;
  }
  if (!changed) return next;
  const total = WEIGHT_KEYS.reduce((sum, k) => sum + next[k], 0);
  if (Math.abs(total - 1) < 1e-12) return next; // no drift when already normalized
  for (const k of WEIGHT_KEYS) next[k] = next[k] / total;
  return next;
}

/**
 * Personal rank score for a place's features under the given weights.
 * Returns 0..100 so it reads like the server best-match score.
 */
export function scoreWithWeights(f: FeatureVec, w: RankWeights): number {
  const raw =
    f.rating01 * w.rating +
    f.proximity01 * w.proximity +
    f.open01 * w.open +
    f.sentiment01 * w.sentiment;
  return Math.round(raw * 1000) / 10; // 1-decimal 0..100
}
