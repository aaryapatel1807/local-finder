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

/**
 * Best-match score, 0..100.
 *
 * score = 100 * ( 0.45 * (bayes/5) + 0.35 * proximity + 0.20 * openBonus )
 * proximity = max(0, 1 - distanceKm / radiusKm)
 */
export function scorePlace(
  place: ScoreInput,
  radiusKm: number,
  meanRating: number = FALLBACK_MEAN_RATING
): number {
  const bayes = bayesianAverage(place.rating, place.reviews, meanRating);
  const distance = place.distanceKm ?? radiusKm; // unknown distance => worst proximity
  const proximity = Math.max(0, 1 - distance / radiusKm);
  const score =
    100 *
    (0.45 * (bayes / 5) + 0.35 * proximity + 0.2 * openBonus(place.isOpen ?? null));
  return Math.round(score * 10) / 10;
}
