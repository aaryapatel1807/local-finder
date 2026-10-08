'use client'

/**
 * Personal on-device ranking (Phase 2 ML workstream).
 *
 * Wraps lib/learner.ts with a localStorage-backed hook. All persistence is
 * try/catch'd with lazy init so it is SSR-safe. Zero server calls — the
 * model, the features, and the state all live in the browser.
 */

import { useCallback, useState } from "react";
import {
  DEFAULT_WEIGHTS,
  featuresOf,
  scoreWithWeights,
  updateWeights,
  type FeatureSource,
  type RankWeights,
} from "../lib/learner";

const KEY = "localfinder_personal_v1";

export type PersonalState = {
  weights: RankWeights;
  interactions: number;
  radiusCounts: Record<number, number>;
  sortCounts: Record<string, number>;
};

export type InteractionType = "tap" | "save" | "call" | "directions";

export type InteractionPlace = FeatureSource & { id: string };

export type InteractionContext = {
  radiusKm: number;
  /** Rank (0-based) at which the place was shown. */
  shownRank: number;
  /** Place shown at rank 0 for the same result list. */
  shownTopPlace: FeatureSource;
  /** Optional: the active sort, so we can track sort preferences too. */
  sort?: string;
};

function freshState(): PersonalState {
  return {
    weights: { ...DEFAULT_WEIGHTS },
    interactions: 0,
    radiusCounts: {},
    sortCounts: {},
  };
}

function readLocal(): PersonalState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return freshState();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return freshState();
    return {
      weights: { ...DEFAULT_WEIGHTS, ...(parsed.weights ?? {}) },
      interactions: typeof parsed.interactions === "number" ? parsed.interactions : 0,
      radiusCounts: parsed.radiusCounts ?? {},
      sortCounts: parsed.sortCounts ?? {},
    };
  } catch {
    return freshState();
  }
}

function persist(next: PersonalState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Quota or privacy mode — ranking just stays in memory for the session.
  }
}

function mostUsed(counts: Record<number, number>): number | undefined {
  let best: number | undefined;
  let bestCount = 0;
  for (const [k, v] of Object.entries(counts)) {
    if (v > bestCount) {
      bestCount = v;
      best = Number(k);
    }
  }
  return bestCount >= 3 ? best : undefined;
}

function mostUsedStr(counts: Record<string, number>): string | undefined {
  let best: string | undefined;
  let bestCount = 0;
  for (const [k, v] of Object.entries(counts)) {
    if (v > bestCount) {
      bestCount = v;
      best = k;
    }
  }
  return bestCount >= 3 ? best : undefined;
}

/**
 * Personal rank learner hook. Read `weights`, `interactions`, and
 * `smartDefaults` from state; `logInteraction` teaches the model;
 * `rerankForYou` applies it to a result list.
 */
export function usePersonalRank() {
  const [state, setState] = useState<PersonalState>(() =>
    typeof window === "undefined" ? freshState() : readLocal()
  );

  const logInteraction = useCallback(
    (type: InteractionType, place: InteractionPlace, ctx: InteractionContext) => {
      setState((prev) => {
        const chosen = featuresOf(place, ctx.radiusKm);
        const shownTop = featuresOf(ctx.shownTopPlace, ctx.radiusKm);
        // When the user engages something shown below the top pick, move the
        // weights toward the chosen place's strengths.
        const weights =
          ctx.shownRank > 0
            ? updateWeights(prev.weights, chosen, shownTop)
            : prev.weights;
        const next: PersonalState = {
          weights,
          interactions: prev.interactions + 1,
          radiusCounts: {
            ...prev.radiusCounts,
            [ctx.radiusKm]: (prev.radiusCounts[ctx.radiusKm] ?? 0) + 1,
          },
          sortCounts: ctx.sort
            ? {
                ...prev.sortCounts,
                [ctx.sort]: (prev.sortCounts[ctx.sort] ?? 0) + 1,
              }
            : prev.sortCounts,
        };
        persist(next);
        return next;
      });
    },
    []
  );

  const rerankForYou = useCallback(
    <T extends { id: string } & FeatureSource>(places: T[], radiusKm: number): T[] => {
      return [...places]
        .map((p) => ({ p, s: scoreWithWeights(featuresOf(p, radiusKm), state.weights) }))
        .sort((a, b) => b.s - a.s)
        .slice(0, 20)
        .map((x) => x.p);
    },
    [state.weights]
  );

  /** true once we've seen enough interactions to trust the personal weights. */
  const suggestForYou = state.interactions > 10;

  /** Most-used radius / sort, only once a clear habit exists (≥ 3 uses). */
  const smartDefaults: { radiusKm?: number; sort?: string } = {
    radiusKm: mostUsed(state.radiusCounts),
    sort: mostUsedStr(state.sortCounts),
  };

  return {
    weights: state.weights,
    interactions: state.interactions,
    logInteraction,
    rerankForYou,
    suggestForYou,
    smartDefaults,
  };
}
