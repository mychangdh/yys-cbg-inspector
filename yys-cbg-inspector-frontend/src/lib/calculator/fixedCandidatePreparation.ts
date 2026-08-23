import type { RelicView } from "../../types";
import type { CalculatorFilters, CalculatorMetric } from "./types";
import { removeDominatedRelics } from "./pruning";
import { selectFixedPatternCandidates } from "./fixedCandidates";

export type PatternCandidateSet = {
  candidates: RelicView[];
  matchingCount: number;
};

type CandidateScorer = (relic: RelicView, metric: CalculatorMetric) => number;

type CriticalCandidateSelector = (
  relics: RelicView[],
  metric: CalculatorMetric,
  filters: CalculatorFilters,
) => RelicView[];

export function prepareFixedPatternCandidates(
  eligibleRelics: RelicView[][],
  positionIndex: number,
  isFourPiece: boolean,
  twoPieceName: string | undefined,
  fixedSuitName: string,
  metric: CalculatorMetric,
  filters: CalculatorFilters,
  scorer: CandidateScorer,
  criticalCandidateSelector: CriticalCandidateSelector,
  limits: {
    candidateLimit: number;
    localReserve: number;
    statReserve: number;
    critDamageReserve: number;
  },
): PatternCandidateSet {
  const matching = eligibleRelics[positionIndex].filter((relic) =>
    isFourPiece
      ? relic.suit?.name === fixedSuitName
      : !twoPieceName || relic.suit?.name === twoPieceName,
  );
  const undominated = removeDominatedRelics(
    matching,
    metric,
    filters,
    (relic) => scorer(relic, metric),
  );
  return {
    candidates: selectFixedPatternCandidates(
      undominated,
      positionIndex,
      metric,
      filters,
      limits,
      criticalCandidateSelector,
    ),
    matchingCount: matching.length,
  };
}
