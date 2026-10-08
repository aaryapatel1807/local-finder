/**
 * Best-match ranking score (spec section 7.6).
 *
 * Pure Google ratings mislead: a 5.0 with 3 reviews should not outrank a
 * 4.6 with 2,000. We use the Bayesian average (IMDb weighted-rating style)
 * so low-volume ratings regress toward the result-set mean, then blend
 * rating, proximity and open status into a 0..100 score.
 */

import type { Place } from "./schemas";

export const BAYES_CONFIDENCE = 50; // m: review-count confidence threshold
export const FALLBACK_MEAN_RATING = 4.2; // C when the result set has no ratings

/**
 * Bayesian average rating for one place.
 *
 * @param rating place rating R (falls back to C when missing)
 * @param reviewCount review volume v
 * @param meanRating mean rating C across the result set
 */
export function bayesianAverage(
  rating: number | undefined,
  reviewCount: number | undefined,
  meanRating: number
): number {
  const v = reviewCount ?? 0;
  const R = rating ?? meanRating;
  const C = meanRating;
  const m = BAYES_CONFIDENCE;
  return (v / (v + m)) * R + (m / (v + m)) * C;
}

/**
 * Mean rating across a result set, used as C. Falls back to 4.2 when no
 * place in the set has a rating.
 */
export function meanRatingOf(places: Pick<Place, "rating">[]): number {
  const rated = places.filter(
    (p) => typeof p.rating === "number" && p.rating > 0
  );
  if (rated.length === 0) return FALLBACK_MEAN_RATING;
  return rated.reduce((sum, p) => sum + (p.rating as number), 0) / rated.length;
}

function openBonus(isOpen: boolean | null): number {
  if (isOpen === true) return 1;
  if (isOpen === null) return 0.5;
  return 0;
}

/**
 * Inputs for scorePlace — every field optional so unrated/unknown places
 * score without NaN.
 */
export type ScoreInput = {
  rating?: number;
  reviews?: number;
  isOpen?: boolean | null;
  distanceKm?: number;
};

const round1 = (n: number): number => Math.round(n * 10) / 10;

/**
 * Best-match score, 0..100.
 *
 * Without sentiment (undefined) the formula is EXACTLY the original:
 *   score = 100 * ( 0.45 * (bayes/5) + 0.35 * proximity + 0.20 * openBonus )
 * proximity = max(0, 1 - distanceKm / radiusKm)
 *
 * With sentiment defined (-1..1, clamped) the weights rebalance to make
 * room for the review-sentiment signal:
 *   score = 100 * ( 0.40 * (bayes/5) + 0.30 * proximity
 *                 + 0.15 * openBonus + 0.15 * sentiment01 )
 * where sentiment01 = (clamp(sentiment) + 1) / 2.
 */
export function scorePlace(
  place: ScoreInput,
  radiusKm: number,
  meanRating: number = FALLBACK_MEAN_RATING,
  sentiment?: number
): number {
  const bayes = bayesianAverage(place.rating, place.reviews, meanRating);
  const distance = place.distanceKm ?? radiusKm; // unknown distance => worst proximity
  const proximity = Math.max(0, 1 - distance / radiusKm);
  const bonus = openBonus(place.isOpen ?? null);

  if (sentiment === undefined || !Number.isFinite(sentiment)) {
    const score = 100 * (0.45 * (bayes / 5) + 0.35 * proximity + 0.2 * bonus);
    return round1(score);
  }

  const sentiment01 = (Math.max(-1, Math.min(1, sentiment)) + 1) / 2;
  const score =
    100 *
    (0.4 * (bayes / 5) + 0.3 * proximity + 0.15 * bonus + 0.15 * sentiment01);
  return round1(score);
}

/**
 * Client-side score nudge from review sentiment. Pure function, no imports.
 * No-op when sentiment is undefined: returns the score unchanged.
 * Otherwise shifts the 0..100 score by up to ±5 points by sentiment
 * (clamped to -1..1, result clamped to 0..100, rounded to 1 decimal).
 */
export function blendSentiment(score: number, sentiment?: number): number {
  if (sentiment === undefined || !Number.isFinite(sentiment)) return score;
  const clamped = Math.max(-1, Math.min(1, sentiment));
  return round1(Math.max(0, Math.min(100, score + clamped * 5)));
}
